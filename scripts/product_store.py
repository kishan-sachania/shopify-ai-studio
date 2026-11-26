import json
import os
from pathlib import Path
from typing import Union, List, Dict, Any, Optional

# Locate workspace root directory
SCRIPTS_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPTS_DIR.parent

# Candidate local storage file locations in order of priority
STORAGE_PATHS = [
    PROJECT_ROOT / "data" / "local_storage_products.json",
    PROJECT_ROOT / "data" / "products_extracted.json",
    PROJECT_ROOT / "products.json",
    PROJECT_ROOT / "data" / "products.json",
]

_cached_mtime: float = 0.0
_cached_products: List[Dict[str, Any]] = []

def get_storage_file() -> Optional[Path]:
    """Finds the first existing local storage file."""
    for p in STORAGE_PATHS:
        if p.exists() and p.is_file():
            return p
    return None

def load_all_local_products(force_reload: bool = False) -> List[Dict[str, Any]]:
    """
    Reads products from local file storage with timestamp-based auto-cache.
    Each product is guaranteed to have an 'id', 'name'/'title', and searchable fields.
    """
    global _cached_mtime, _cached_products

    storage_file = get_storage_file()
    if not storage_file:
        return []

    try:
        current_mtime = os.path.getmtime(storage_file)
        if not force_reload and _cached_products and current_mtime == _cached_mtime:
            return _cached_products

        content = storage_file.read_text(encoding="utf-8").strip()
        if not content:
            return []

        raw_data = json.loads(content)
        if not isinstance(raw_data, list):
            raw_data = [raw_data]

        normalized: List[Dict[str, Any]] = []
        for idx, item in enumerate(raw_data):
            if not isinstance(item, dict):
                continue
            
            prod = dict(item)
            # Ensure an ID exists
            if not prod.get("id"):
                prod["id"] = f"prod_{idx + 1}"
            
            # Ensure name or title is populated
            title = prod.get("title") or prod.get("name") or f"Product {idx + 1}"
            prod["title"] = title
            if "name" not in prod:
                prod["name"] = title

            normalized.append(prod)

        _cached_products = normalized
        _cached_mtime = current_mtime
        return _cached_products
    except Exception as e:
        print(f"[product_store] Warning reading local storage: {e}")
        return _cached_products or []

def find_single_product(identifier: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    Finds a single product by:
    1. Exact ID match (e.g. 'prod_123', '101')
    2. Case-insensitive Name / Title match
    3. Composite 'Title - Variant/Flavor' match
    4. Numeric index (0-based or 1-based)
    """
    products = load_all_local_products()
    if not products:
        return None

    str_id = str(identifier).strip()
    lower_id = str_id.lower()

    # 1. Exact ID match
    for p in products:
        if str(p.get("id", "")).strip() == str_id:
            return p

    # 2. Exact or normalized Title / Name match
    for p in products:
        title = str(p.get("title") or p.get("name") or "").strip().lower()
        if title == lower_id:
            return p

    # 3. Composite 'Title - Flavor' or 'Title – Flavor' match
    for p in products:
        title = str(p.get("title") or "").strip().lower()
        flavor = str(p.get("variant_or_flavor") or "").strip().lower()
        if flavor:
            combo1 = f"{title} - {flavor}"
            combo2 = f"{title} – {flavor}"
            if combo1 == lower_id or combo2 == lower_id:
                return p

    # 4. Partial substring title match if unambiguous
    for p in products:
        title = str(p.get("title") or "").strip().lower()
        if lower_id in title:
            return p

    # 5. Numeric row index fallback
    if str_id.isdigit():
        idx = int(str_id)
        if 0 <= idx < len(products):
            return products[idx]
        if 1 <= idx <= len(products):
            return products[idx - 1]

    return None

def get_products(
    name_id: Union[str, int, List[Union[str, int]]]
) -> Union[Optional[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Main lookup function:
    - If passed a single identifier (str/int) -> returns a single product dict (or None).
    - If passed an array / list of identifiers -> returns a list of matched product dicts.
    """
    if isinstance(name_id, (list, tuple)):
        results: List[Dict[str, Any]] = []
        for item in name_id:
            found = find_single_product(item)
            if found:
                results.append(found)
        return results

    return find_single_product(name_id)

def save_local_storage_sync(products: List[Dict[str, Any]]) -> str:
    """Saves products payload directly to local_storage_products.json."""
    dest = PROJECT_ROOT / "data" / "local_storage_products.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(products, indent=2, ensure_ascii=False), encoding="utf-8")
    load_all_local_products(force_reload=True)
    return str(dest)
