import logging
import json
import requests
from typing import Dict, Any, Tuple
from spapi_client.mappings import MARKETPLACE_MAP
import os

logger = logging.getLogger(__name__)

class SpApiPatcher:
    """Handles creating and sending PATCH requests to Amazon SP-API Listings Items API."""

    def __init__(self, seller_id: str, authenticator):
        self.seller_id = seller_id
        self.authenticator = authenticator
        self._product_type_cache: Dict[str, str] = {}  # ASIN -> product type cache

    def get_product_type_for_asin(self, asin: str, marketplace_id: str, endpoint: str) -> str:
        """
        Queries the Amazon Catalog Items API to fetch the official productType for a given ASIN.
        Falls back to 'PRODUCT' if lookup fails.
        """
        if asin in self._product_type_cache:
            return self._product_type_cache[asin]

        access_token = self.authenticator.get_access_token()
        url = f"{endpoint}/catalog/2022-04-01/items/{asin}"
        headers = {
            "x-amz-access-token": access_token,
            "Accept": "application/json"
        }
        params = {
            "marketplaceIds": marketplace_id,
            "includedData": "productTypes"
        }
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                product_type = data.get("productTypes", [{}])[0].get("productType", "PRODUCT")
                logger.info(f"Auto-detected productType for ASIN {asin}: {product_type}")
                self._product_type_cache[asin] = product_type
                return product_type
            else:
                logger.warning(f"Catalog API failed for ASIN {asin}: {response.status_code} {response.text[:200]}")
        except Exception as e:
            logger.error(f"Catalog API exception for ASIN {asin}: {e}")

        return "PRODUCT"  # Safe fallback

    def get_listing_metadata(self, sku: str, marketplace_id: str, endpoint: str) -> Tuple[str, str]:
        """
        Calls GET /listings/2021-08-01/items/{sellerId}/{sku} to fetch the
        asin and productType for a given SKU.
        Returns: (asin, product_type)
        """
        access_token = self.authenticator.get_access_token()
        import urllib.parse
        sku_encoded = urllib.parse.quote(sku, safe='')
        url = f"{endpoint}/listings/2021-08-01/items/{self.seller_id}/{sku_encoded}"
        
        headers = {
            "x-amz-access-token": access_token,
            "Accept": "application/json"
        }
        params = {
            "marketplaceIds": marketplace_id,
            "includedData": "summaries"
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                summaries = data.get("summaries", [])
                if summaries:
                    asin = summaries[0].get("asin")
                    product_type = summaries[0].get("productType")
                    logger.info(f"Auto-discovered metadata for SKU {sku}: ASIN={asin}, Type={product_type}")
                    return asin, product_type
            else:
                logger.warning(f"Listing Metadata API failed for SKU {sku}: {response.status_code}")
        except Exception as e:
            logger.error(f"Listing Metadata lookup error for SKU {sku}: {e}")
            
        return None, "PRODUCT"

    def build_dynamic_payload(self, marketplace_id: str, language_tag: str, product_type: str, payload_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Builds the strict JSON structure required by SP-API to patch various attributes dynamically.
        """
        patches = []
        
        if "search_terms" in payload_data:
            patches.append({
                "op": "replace",
                "path": "/attributes/generic_keyword",
                "value": [{"marketplace_id": marketplace_id, "language_tag": language_tag, "value": payload_data["search_terms"]}]
            })
            
        if "title" in payload_data:
            patches.append({
                "op": "replace",
                "path": "/attributes/item_name",
                "value": [{"marketplace_id": marketplace_id, "language_tag": language_tag, "value": payload_data["title"]}]
            })
            
        if "description" in payload_data:
            patches.append({
                "op": "replace",
                "path": "/attributes/product_description",
                "value": [{"marketplace_id": marketplace_id, "language_tag": language_tag, "value": payload_data["description"]}]
            })
            
        if "bullet_points" in payload_data:
            bullet_objects = [{"marketplace_id": marketplace_id, "language_tag": language_tag, "value": bp} for bp in payload_data["bullet_points"]]
            patches.append({
                "op": "replace",
                "path": "/attributes/bullet_point",
                "value": bullet_objects
            })
            
        if "main_image" in payload_data:
            patches.append({
                "op": "replace",
                "path": "/attributes/main_product_image_locator",
                "value": [{"marketplace_id": marketplace_id, "media_location": payload_data["main_image"]}]
            })
            
        why_choose_url = payload_data.get("why_choose_us_image")
        lifestyle_urls = payload_data.get("lifestyle_images") or []

        # Amazon supports other_product_image_locator_1..8
        max_other_slots = 8

        # Other images: guarantee Why-Choose-Us in slot 2 if provided, and pack lifestyle images around it.
        if why_choose_url or lifestyle_urls:
            used_slots = set()
            other_image_pairs = []  # (slot_number, url)

            if why_choose_url:
                other_image_pairs.append((2, why_choose_url))
                used_slots.add(2)

            slot = 1
            for img_url in lifestyle_urls:
                while slot in used_slots:
                    slot += 1
                if slot > max_other_slots:
                    break
                other_image_pairs.append((slot, img_url))
                used_slots.add(slot)
                slot += 1

            for slot, img_url in sorted(other_image_pairs, key=lambda x: x[0]):
                patches.append({
                    "op": "replace",
                    "path": f"/attributes/other_product_image_locator_{slot}",
                    "value": [{"marketplace_id": marketplace_id, "media_location": img_url}],
                })

        return {
            "productType": product_type,
            "patches": patches
        }
        
        

    def patch_listing(self, sku: str, country_code: str, payload_data: Dict[str, Any], dry_run: bool = False) -> Tuple[bool, Any]:
        """
        Executes the PATCH request for a given SKU.
        Returns:
            (Success status: bool, Response Message: str)
        """
        country_code = country_code.upper().strip()
        if country_code not in MARKETPLACE_MAP:
            return False, f"Unsupported country code '{country_code}'."

        market_info = MARKETPLACE_MAP[country_code]
        marketplace_id = market_info["marketplace_id"]
        endpoint = market_info["endpoint"]
        language_tag = market_info.get("language_tag", "en_US")

        # Auto-detect product type from ASIN if available, else fall back to "PRODUCT"
        asin = payload_data.get("asin") or payload_data.get("sku")
        
        # If we have a SKU but no explicit product_type, we can try to look it up
        product_type = payload_data.get("product_type")
        if not product_type:
            # Check cache or fetch
            if asin in self._product_type_cache:
                product_type = self._product_type_cache[asin]
            else:
                # If identifier looks like a SKU (dashes/length) we might want to do a listings lookup
                # but for simplicity we'll try catalog first
                product_type = self.get_product_type_for_asin(asin, marketplace_id, endpoint)

        # 1. Build Payload
        payload = self.build_dynamic_payload(marketplace_id, language_tag, product_type, payload_data)

        # Construct URL Format: /listings/2021-08-01/items/{sellerId}/{sku}
        import urllib.parse
        sku_encoded = urllib.parse.quote(sku, safe='')
        url = f"{endpoint}/listings/2021-08-01/items/{self.seller_id}/{sku_encoded}"

        if os.getenv("SPAPI_DIAGNOSTICS", "false").lower() == "true":
            import json as _json
            logger.info("=" * 60)
            logger.info(f"[DIAGNOSTIC] SKU            : {sku}")
            logger.info(f"[DIAGNOSTIC] ASIN           : {asin}")
            logger.info(f"[DIAGNOSTIC] Account ID     : {self.seller_id}")
            logger.info(f"[DIAGNOSTIC] Marketplace ID : {marketplace_id}")
            logger.info(f"[DIAGNOSTIC] Language Tag   : {language_tag}")
            logger.info(f"[DIAGNOSTIC] Product Type   : {product_type}")
            logger.info(f"[DIAGNOSTIC] Endpoint URL   : {url}")
            logger.info(f"[DIAGNOSTIC] Payload        : {_json.dumps(payload, indent=2)}")
            logger.info("=" * 60)

        if dry_run:
            dry_run_msg = f"DRY RUN. Would patch '{sku}' at {url} with provided fields."
            logger.info(dry_run_msg)
            logger.info(f"Payload: {json.dumps(payload, indent=2)}")
            return True, "Dry Run Success"

        # 2. Get Access Token
        access_token = self.authenticator.get_access_token()

        # 3. Construct Headers
        headers = {
            "x-amz-access-token": access_token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        # URL parameters require the marketplaceIds
        params = {
            "marketplaceIds": marketplace_id,
            "issueLocale": language_tag
        }

        logger.info(f"Sending PATCH for SKU: {sku} across {country_code}")
        
        try:
            response = requests.patch(
                url, 
                headers=headers, 
                params=params,
                json=payload, 
                timeout=15
            )
            
            if response.status_code in [200, 202]:
                try:
                    resp_data = response.json()
                    logger.info(f"PATCH Success for {sku}. Response: {json.dumps(resp_data)}")
                except Exception:
                    resp_data = response.text
                    logger.info(f"PATCH Success for {sku}. Response: {resp_data}")
                return True, resp_data
            else:
                # 400s and 500s - log everything
                import json as _json
                err_msg = ""
                try:
                    js = response.json()
                    logger.error(f"[ERROR] HTTP {response.status_code} for SKU {sku}")
                    logger.error(f"[ERROR] Full Amazon Response: {_json.dumps(js, indent=2)}")
                    logger.error(f"[ERROR] Request URL was: {url}")
                    logger.error(f"[ERROR] Seller ID used : {self.seller_id}")
                    errors = js.get("errors", [])
                    if errors:
                        err_msg = " | ".join([e.get("message", "") for e in errors])
                    else:
                        err_msg = _json.dumps(js)
                except Exception:
                    err_msg = response.text
                    logger.error(f"[ERROR] Raw response text: {err_msg}")
                
                return False, f"API Error {response.status_code}: {err_msg}"
                
        except requests.exceptions.RequestException as e:
            return False, f"Network Error: {str(e)}"

    def delete_listing(self, sku: str, country_code: str, asin: str = None, dry_run: bool = False) -> Tuple[bool, Any]:
        """
        Executes a DELETE request to completely remove a sku listing from Amazon.
        """
        country_code = country_code.upper().strip()
        if country_code not in MARKETPLACE_MAP:
            return False, f"Unsupported country code '{country_code}'."

        market_info = MARKETPLACE_MAP[country_code]
        marketplace_id = market_info["marketplace_id"]
        endpoint = market_info["endpoint"]
        language_tag = market_info.get("language_tag", "en_US")

        # Construct URL Format: DELETE /listings/2021-08-01/items/{sellerId}/{sku}
        import urllib.parse
        sku_encoded = urllib.parse.quote(sku, safe='')
        url = f"{endpoint}/listings/2021-08-01/items/{self.seller_id}/{sku_encoded}"

        logger.info(f"Preparing to DELETE SKU: {sku} across {country_code}")

        if dry_run:
            return True, f"Dry Run Success: Would have deleted '{sku}' at {url}"

        access_token = self.authenticator.get_access_token()
        headers = {
            "x-amz-access-token": access_token,
            "Accept": "application/json"
        }
        
        params = {
            "marketplaceIds": marketplace_id,
            "issueLocale": language_tag
        }

        try:
            response = requests.delete(
                url, 
                headers=headers, 
                params=params,
                timeout=15
            )
            
            if response.status_code in [200, 202, 204]:
                try:
                    resp_data = response.json()
                except Exception:
                    resp_data = response.text
                logger.info(f"DELETE Success for {sku}. Response: {resp_data}")
                return True, resp_data
            else:
                import json as _json
                err_msg = ""
                try:
                    js = response.json()
                    errors = js.get("errors", [])
                    if errors:
                        err_msg = " | ".join([e.get("message", "") for e in errors])
                    else:
                        err_msg = _json.dumps(js)
                except Exception:
                    err_msg = response.text
                
                return False, f"API Error {response.status_code}: {err_msg}"
                
        except requests.exceptions.RequestException as e:
            return False, f"Network Error: {str(e)}"

    # ─────────────────────────────────────────────────────────────────
    # Map of user-friendly attribute names → SP-API field names
    # ─────────────────────────────────────────────────────────────────
    ATTRIBUTE_FIELD_MAP = {
        "title":              "item_name",
        "bullet_point_1":     "bullet_point",
        "bullet_point_2":     "bullet_point",
        "bullet_point_3":     "bullet_point",
        "bullet_point_4":     "bullet_point",
        "bullet_point_5":     "bullet_point",
        "main_image":         "main_product_image_locator",
        "lifestyle_image_1":  "other_product_image_locator_1",
        "lifestyle_image_2":  "other_product_image_locator_2",
        "lifestyle_image_3":  "other_product_image_locator_3",
        "lifestyle_image_4":  "other_product_image_locator_4",
        "lifestyle_image_5":  "other_product_image_locator_5",
        "lifestyle_image_6":  "other_product_image_locator_6",
        "lifestyle_image_7":  "other_product_image_locator_7",
        "lifestyle_image_8":  "other_product_image_locator_8",
        "why_choose_us_image":"other_product_image_locator_2",
        "description":        "product_description",
        "search_terms":       "generic_keyword",
    }

    def delete_attribute(
        self,
        sku: str,
        country_code: str,
        attribute_key: str,
        asin: str = None,
        dry_run: bool = False
    ) -> Tuple[bool, Any]:
        """
        Removes a single attribute (title, a bullet point, one image slot, etc.)
        from a listing using patchListingsItem with op=delete (RFC 6902 JSON Patch).

        attribute_key must be one of the keys in ATTRIBUTE_FIELD_MAP.
        """
        import urllib.parse, json as _json

        country_code = country_code.upper().strip()
        if country_code not in MARKETPLACE_MAP:
            return False, f"Unsupported country code '{country_code}'."

        if attribute_key not in self.ATTRIBUTE_FIELD_MAP:
            return False, f"Unknown attribute '{attribute_key}'. Valid keys: {list(self.ATTRIBUTE_FIELD_MAP.keys())}"

        market_info   = MARKETPLACE_MAP[country_code]
        marketplace_id = market_info["marketplace_id"]
        endpoint      = market_info["endpoint"]
        language_tag  = market_info.get("language_tag", "en_US")

        # Resolve the actual SP-API field name
        field_name = self.ATTRIBUTE_FIELD_MAP[attribute_key]

        # Auto-detect ASIN/ProductType if not provided
        product_type = "PRODUCT"
        if not asin:
            asin, product_type = self.get_listing_metadata(sku, marketplace_id, endpoint)
        else:
            product_type = self.get_product_type_for_asin(asin, marketplace_id, endpoint)

        # Build JSON Patch payload
        # For image fields and bulk-array deletes, we must supply marketplace_id in value
        image_fields = {
            "main_product_image_locator",
            "other_product_image_locator_1",
            "other_product_image_locator_2",
            "other_product_image_locator_3",
            "other_product_image_locator_4",
            "other_product_image_locator_5",
            "other_product_image_locator_6",
            "other_product_image_locator_7",
            "other_product_image_locator_8",
        }
        if field_name in image_fields:
            patch = {
                "op": "delete",
                "path": f"/attributes/{field_name}",
                "value": [{"marketplace_id": marketplace_id}]
            }
        else:
            patch = {
                "op": "delete",
                "path": f"/attributes/{field_name}"
            }

        payload = {
            "productType": product_type,
            "patches": [patch]
        }

        sku_encoded = urllib.parse.quote(sku, safe='')
        url = f"{endpoint}/listings/2021-08-01/items/{self.seller_id}/{sku_encoded}"

        logger.info(
            f"[delete_attribute] SKU={sku} country={country_code} "
            f"attribute_key={attribute_key} -> field={field_name} | payload={_json.dumps(payload)}"
        )

        if dry_run:
            return True, {
                "dry_run": True,
                "url": url,
                "payload": payload,
                "message": f"Would delete '{field_name}' for '{sku}' on {country_code}"
            }

        access_token = self.authenticator.get_access_token()
        headers = {
            "x-amz-access-token": access_token,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        params = {
            "marketplaceIds": marketplace_id,
            "issueLocale": language_tag
        }

        try:
            response = requests.patch(url, headers=headers, params=params, json=payload, timeout=15)

            if response.status_code in [200, 202]:
                try:
                    resp_data = response.json()
                except Exception:
                    resp_data = response.text
                logger.info(f"[delete_attribute] Success for {sku} / {field_name}: {resp_data}")
                return True, resp_data
            else:
                err_msg = ""
                try:
                    js = response.json()
                    errors = js.get("errors", []) or js.get("issues", [])
                    if errors:
                        err_msg = " | ".join([e.get("message", str(e)) for e in errors])
                    else:
                        err_msg = _json.dumps(js)
                except Exception:
                    err_msg = response.text
                logger.error(f"[delete_attribute] API Error {response.status_code}: {err_msg}")
                return False, f"API Error {response.status_code}: {err_msg}"

        except requests.exceptions.RequestException as e:
            return False, f"Network Error: {str(e)}"
