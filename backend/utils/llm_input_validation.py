import pandas as pd
import difflib
from typing import Dict, Any, Tuple, Optional

def get_metadata_lists(df):
    """Extract category and major_category lists from the dataframe"""
    if 'category' not in df.columns:
        return {}, {}
        
    categories = set(df['category'].dropna().unique())
    
    major_categories = set()
    if 'major category' in df.columns:
        major_categories = set(df['major category'].dropna().unique())
    
    # Case-insensitive lookup dictionaries
    category_lookup = {str(cat).lower(): cat for cat in categories}
    major_category_lookup = {str(cat).lower(): cat for cat in major_categories}
    
    return category_lookup, major_category_lookup

def validate_and_fix_params(params: Dict[str, Any], df: pd.DataFrame) -> Tuple[Dict[str, Any], Optional[str]]:
    """
    Validates and auto-corrects parameters from LLM output.
    Now handles SINGLE 'category' input and maps it to major or specific category.
    """
    category_lookup, major_category_lookup = get_metadata_lists(df)
    cleaned_params = params.copy()
    warnings = []
    
    # Extract the INPUT category (LLM now only sees 'category')
    # But we check both just in case LLM still uses major_category
    input_cat = params.get('category') or params.get('major_category')
    
    # Strip backticks/quotes if present
    if isinstance(input_cat, str):
        input_cat = input_cat.strip('`').strip("'").strip('"').strip()
    
    # If no category provided, nothing to validate for categories
    if not input_cat:
        return cleaned_params, None

    # --- HELPER: FUZZY MATCHER ---
    def find_best_match(value, lookup_dict):
        """Returns (matched_real_name, confidence_score) or (None, 0)"""
        if not value: return None, 0
        val_lower = str(value).lower()
        
        # 1. Exact match
        if val_lower in lookup_dict:
            return lookup_dict[val_lower], 1.0
            
        # 2. Simple Plural/Singular Heuristics
        if val_lower.endswith('s') and val_lower[:-1] in lookup_dict:
            return lookup_dict[val_lower[:-1]], 0.9
        if val_lower.endswith('ies') and (val_lower[:-3] + 'y') in lookup_dict:
            return lookup_dict[val_lower[:-3] + 'y'], 0.9
            
        # 3. Fuzzy match
        matches = difflib.get_close_matches(val_lower, lookup_dict.keys(), n=1, cutoff=0.8)
        if matches:
            return lookup_dict[matches[0]], 0.8
            
        return None, 0

    # Logic:
    # 1. Check if it's a Major Category
    # 2. Check if it's a Specific Category
    # 3. If neither, assume it's a Remark/Keyword
    
    match_major, score_major = find_best_match(input_cat, major_category_lookup)
    match_cat, score_cat = find_best_match(input_cat, category_lookup)
    
    # Decide which match is better
    if score_major >= 0.8 and score_major >= score_cat:
        # It's a Major Category
        cleaned_params.pop('category', None)
        cleaned_params['major_category'] = match_major
        if input_cat != match_major:
            warnings.append(f"Mapped '{input_cat}' to broad group '{match_major}'")
            
    elif score_cat >= 0.8:
        # It's a Specific Category
        cleaned_params.pop('major_category', None) # Ensure we don't have conflicting args
        cleaned_params['category'] = match_cat
        if input_cat != match_cat:
             warnings.append(f"Corrected '{input_cat}' to category '{match_cat}'")
             
    else:
        # Not a known category -> treat as search term (remarks)
        cleaned_params.pop('category', None)
        cleaned_params.pop('major_category', None)
        cleaned_params['remarks'] = input_cat
        warnings.append(f"'{input_cat}' not a category. Searching in remarks instead.")
    
    warning_msg = " | ".join(warnings) if warnings else None
    return cleaned_params, warning_msg