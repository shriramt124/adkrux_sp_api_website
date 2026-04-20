import json
import os
import time
import hashlib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import requests


@dataclass(frozen=True)
class SellerCredentials:
    default_seller_id: str
    lwa_client_id: str
    lwa_client_secret: str
    lwa_refresh_token: str


@dataclass(frozen=True)
class VendorCredentials:
    default_vendor_code: str
    vendor_client_id: str
    vendor_client_secret: str
    vendor_refresh_token: str


@dataclass(frozen=True)
class ClientConfig:
    id: str
    name: str
    seller: Optional[SellerCredentials] = None
    vendor: Optional[VendorCredentials] = None


class CredentialStore:
    """Loads per-client SP-API credentials from a single JSON file.

    Sources supported:
    - Local file path (SPAPI_CLIENTS_CONFIG_PATH)
    - SharePoint/OneDrive via Microsoft Graph (GRAPH_* + SPAPI_CLIENTS_* vars)

    Only Graph credentials should live in env; SP-API creds live in the JSON.
    """

    def __init__(self) -> None:
        self._clients: Dict[str, ClientConfig] = {}
        self._loaded_at: float = 0
        self._raw_version: str = ""
        self._config_sha256: str = ""

    def maybe_reload(self, *, max_age_s: int = 300) -> None:
        if not self._clients or (time.time() - self._loaded_at) > max_age_s:
            self.reload()

    def reload(self) -> None:
        text = self._load_config_text()
        self._config_sha256 = hashlib.sha256(text.encode("utf-8")).hexdigest()
        data = json.loads(text)

        clients_in: List[Dict[str, Any]] = data.get("clients") or []
        out: Dict[str, ClientConfig] = {}

        for c in clients_in:
            cid = str(c.get("id") or "").strip()
            if not cid:
                continue
            name = str(c.get("name") or cid).strip()

            seller = None
            if isinstance(c.get("seller"), dict):
                s = c["seller"]
                if all(s.get(k) for k in ["default_seller_id", "lwa_client_id", "lwa_client_secret", "lwa_refresh_token"]):
                    seller = SellerCredentials(
                        default_seller_id=str(s["default_seller_id"]).strip(),
                        lwa_client_id=str(s["lwa_client_id"]).strip(),
                        lwa_client_secret=str(s["lwa_client_secret"]).strip(),
                        lwa_refresh_token=str(s["lwa_refresh_token"]).strip(),
                    )

            vendor = None
            if isinstance(c.get("vendor"), dict):
                v = c["vendor"]
                if all(v.get(k) for k in ["default_vendor_code", "vendor_client_id", "vendor_client_secret", "vendor_refresh_token"]):
                    vendor = VendorCredentials(
                        default_vendor_code=str(v["default_vendor_code"]).strip(),
                        vendor_client_id=str(v["vendor_client_id"]).strip(),
                        vendor_client_secret=str(v["vendor_client_secret"]).strip(),
                        vendor_refresh_token=str(v["vendor_refresh_token"]).strip(),
                    )

            out[cid] = ClientConfig(id=cid, name=name, seller=seller, vendor=vendor)

        if not out:
            raise RuntimeError("No clients loaded from credential config")

        self._clients = out
        self._loaded_at = time.time()
        self._raw_version = str(data.get("version") or "")

    def meta_safe(self) -> Dict[str, Any]:
        """Return metadata safe to send to frontend (no secrets)."""
        return {
            "version": self._raw_version,
            "loaded_at": self._loaded_at,
            "age_s": (time.time() - self._loaded_at) if self._loaded_at else None,
            "client_count": len(self._clients),
            "config_sha256": self._config_sha256,
            "cache_s": int(os.getenv("SPAPI_CLIENTS_CACHE_S", "300")),
            "source": "graph" if all(
                os.getenv(k, "").strip() for k in [
                    "GRAPH_TENANT_ID",
                    "GRAPH_CLIENT_ID",
                    "GRAPH_CLIENT_SECRET",
                    "SPAPI_CLIENTS_SITE_ID",
                    "SPAPI_CLIENTS_DRIVE_ID",
                    "SPAPI_CLIENTS_ITEM_PATH",
                ]
            ) else ("file" if os.getenv("SPAPI_CLIENTS_CONFIG_PATH", "").strip() else "none"),
        }

    def list_clients_safe(self) -> List[Dict[str, Any]]:
        """Return a list safe to send to frontend (no secrets)."""
        result: List[Dict[str, Any]] = []
        for c in sorted(self._clients.values(), key=lambda x: x.id.lower()):
            result.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "has_seller": bool(c.seller),
                    "has_vendor": bool(c.vendor),
                    "default_seller_id": c.seller.default_seller_id if c.seller else None,
                    "default_vendor_code": c.vendor.default_vendor_code if c.vendor else None,
                }
            )
        return result

    def get_client(self, client_id: str) -> ClientConfig:
        cid = str(client_id or "").strip()
        if not cid or cid not in self._clients:
            raise KeyError(f"Unknown client_id '{client_id}'")
        return self._clients[cid]

    # ------------------------
    # Config sources
    # ------------------------

    def _load_config_text(self) -> str:
        # Graph-based SharePoint/OneDrive fetch (preferred when configured)
        tenant_id = os.getenv("GRAPH_TENANT_ID", "").strip()
        client_id = os.getenv("GRAPH_CLIENT_ID", "").strip()
        client_secret = os.getenv("GRAPH_CLIENT_SECRET", "").strip()
        site_id = os.getenv("SPAPI_CLIENTS_SITE_ID", "").strip()
        drive_id = os.getenv("SPAPI_CLIENTS_DRIVE_ID", "").strip()
        item_path = os.getenv("SPAPI_CLIENTS_ITEM_PATH", "").strip().lstrip("/")

        if all([tenant_id, client_id, client_secret, site_id, drive_id, item_path]):
            token = _get_graph_access_token(tenant_id, client_id, client_secret)
            url = f"https://graph.microsoft.com/v1.0/sites/{site_id}/drives/{drive_id}/root:/{item_path}:/content"
            resp = requests.get(url, headers={"Authorization": f"Bearer {token}"}, timeout=30)
            resp.raise_for_status()
            return resp.text

        # Local file path (dev)
        path = os.getenv("SPAPI_CLIENTS_CONFIG_PATH", "").strip()
        if path:
            with open(path, "r", encoding="utf-8") as f:
                return f.read()

        raise RuntimeError(
            "No credential config source configured. Set either SPAPI_CLIENTS_CONFIG_PATH or "
            "GRAPH_TENANT_ID/GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET + SPAPI_CLIENTS_SITE_ID/SPAPI_CLIENTS_DRIVE_ID/SPAPI_CLIENTS_ITEM_PATH"
        )


def _get_graph_access_token(tenant_id: str, client_id: str, client_secret: str) -> str:
    """Client-credential flow for Microsoft Graph."""
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "https://graph.microsoft.com/.default",
    }
    resp = requests.post(token_url, data=data, timeout=30)
    resp.raise_for_status()
    js = resp.json()
    tok = js.get("access_token")
    if not tok:
        raise RuntimeError("Graph token missing access_token")
    return tok
