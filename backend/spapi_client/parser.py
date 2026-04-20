import pandas as pd
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

class ExcelParser:
    """Parses the input Excel listings file and yields data structures ready for SP-API."""

    def __init__(
        self,
        filepath: str,
        enable_search_terms: bool = True,
        enable_title: bool = False,
        enable_description: bool = False,
        enable_bullet_points: bool = False,
        enable_main_image: bool = False,
        enable_lifestyle_images: bool = False,
        enable_why_choose_us_image: bool = False,
    ):
        self.filepath = filepath
        self.enable_search_terms = enable_search_terms
        self.enable_title = enable_title
        self.enable_description = enable_description
        self.enable_bullet_points = enable_bullet_points
        self.enable_main_image = enable_main_image
        self.enable_lifestyle_images = enable_lifestyle_images
        self.enable_why_choose_us_image = enable_why_choose_us_image

    def parse(self) -> List[Dict[str, str]]:
        """
        Reads the excel file and returns a list of dictionaries with extracted data:
        - sku
        - country
        - search_terms
        """
        logger.info(f"Reading excel sheet from {self.filepath}")
        try:
            df = pd.read_excel(self.filepath)
        except Exception as e:
            logger.error(f"Failed to read file {self.filepath}: {e}")
            raise

        columns = df.columns.tolist()
        columns_lower = [c.lower() for c in columns]
        
        # Detect SKU column
        sku_col = None
        for cand in ["sku_required", "SKU_REQUIRED", "sku", "SKU"]:
            if cand in columns:
                sku_col = cand
                break
        
        # Detect dedicated ASIN column separately (used for product type lookup)
        asin_col = None
        for cand in ["asin", "ASIN", "Asin"]:
            if cand in columns:
                asin_col = cand
                break

        # If no explicit SKU col found, fall back to ASIN col as SKU
        if not sku_col:
            sku_col = asin_col
        
        country_col = "Country" if "Country" in columns else "country"
        terms_col = "search terms" if "search terms" in columns else None
        title_col = "rcm title" if "rcm title" in columns else None
        desc_col = "descrp" if "descrp" in columns else None
        bp_cols = [c for c in ["rcm kf1", "rcm kf2", "rcm kf3", "rcm kf4", "rcm kf5"] if c in columns]
        main_img_col = "main_image" if "main_image" in columns else None
        lifestyle_img_cols = [c for c in [
            "lifestyle_image_1",
            "lifestyle_image_2",
            "lifestyle_image_3",
            "lifestyle_image_4",
            "lifestyle_image_5",
            "lifestyle_image_6",
            "lifestyle_image_7",
            "lifestyle_image_8",
        ] if c in columns]

        # Optional: a dedicated image that should always occupy slot 2 on Amazon
        why_choose_us_img_col = None
        for cand in ["why_choose_us_image", "why choose us image", "why_choose_us"]:
            if cand in columns:
                why_choose_us_img_col = cand
                break
        if not why_choose_us_img_col:
            for cand in ["why_choose_us_image", "why choose us image", "why_choose_us"]:
                if cand in columns_lower:
                    why_choose_us_img_col = columns[columns_lower.index(cand)]
                    break

        if not sku_col or country_col not in columns:
            raise ValueError(f"Missing required SKUs or Country columns. Found: {columns}.")
            
        logger.info(f"Using {sku_col} as SKU column. Proceeding to extract data...")

        results = []
        for index, row in df.iterrows():
            sku = str(row[sku_col]).strip()
            country = str(row[country_col]).strip()
            
            # Skip invalid or empty rows
            if sku.lower() in ["nan", "none", ""]:
                continue
                
            entry = {
                "sku": sku,
                "country": country
            }
            
            # Store ASIN separately if a dedicated ASIN column exists
            if asin_col and asin_col != sku_col:
                asin_val = str(row[asin_col]).strip()
                if asin_val.lower() not in ["nan", "none", ""]:
                    entry["asin"] = asin_val
            
            has_data = False
            
            if self.enable_search_terms and terms_col:
                val = str(row[terms_col]).strip()
                if val.lower() not in ["nan", "none", ""]:
                    entry["search_terms"] = val
                    has_data = True

            if self.enable_title and title_col:
                val = str(row[title_col]).strip()
                if val.lower() not in ["nan", "none", ""]:
                    entry["title"] = val
                    has_data = True

            if self.enable_description and desc_col:
                val = str(row[desc_col]).strip()
                if val.lower() not in ["nan", "none", ""]:
                    entry["description"] = val
                    has_data = True

            if self.enable_bullet_points and bp_cols:
                bullets = []
                for bp_col in bp_cols:
                    val = str(row[bp_col]).strip()
                    if val.lower() not in ["nan", "none", ""]:
                        bullets.append(val)
                if bullets:
                    entry["bullet_points"] = bullets
                    has_data = True
                    
            if self.enable_main_image and main_img_col:
                val = str(row[main_img_col]).strip()
                if val.lower() not in ["nan", "none", ""]:
                    entry["main_image"] = val
                    has_data = True

            if self.enable_why_choose_us_image and why_choose_us_img_col:
                val = str(row[why_choose_us_img_col]).strip()
                if val.lower() not in ["nan", "none", ""]:
                    entry["why_choose_us_image"] = val
                    has_data = True

            if self.enable_lifestyle_images and lifestyle_img_cols:
                lifestyle_imgs = []
                for li_col in lifestyle_img_cols:
                    val = str(row[li_col]).strip()
                    if val.lower() not in ["nan", "none", ""]:
                        lifestyle_imgs.append(val)
                if lifestyle_imgs:
                    entry["lifestyle_images"] = lifestyle_imgs
                    has_data = True
                    
            if has_data:
                results.append(entry)

        logger.info(f"Extraction complete. Found {len(results)} valid rows to update.")
        return results
