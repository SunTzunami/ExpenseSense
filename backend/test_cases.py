"""
Test suite for the ExpenseSense tool-calling benchmark.

Each test case has a *computed* complexity score based on 6 measurable features:
  - n_params:  number of expected parameters
  - d_date:    date specification complexity (0=none, 1=year, 2=year+month, 3=range, 4=day)
  - d_cat:     category normalization distance (0=exact, 1=plural/minor, 2=semantic mapping)
  - d_rel:     uses relative time expression (0/1)
  - d_multi:   compound/multi-value param groups (e.g. comparison with 2 date sets)
  - d_abbr:    contains abbreviated years/informal date formats (0/1)

complexity = n_params + d_date + d_cat + d_rel + d_multi + d_abbr
Binning: L1 (<=4), L2 (5-7), L3 (>=8)
"""

from typing import Any
import re


# ── Complexity scoring ──────────────────────────────────────────────────────

def _compute_date_complexity(expected: dict[str, Any]) -> int:
    """Score the date specification complexity of a test case."""
    has_day = "day" in expected or "d1" in expected or "d2" in expected
    has_range = ("start_year" in expected and "end_year" in expected) or \
                ("y1" in expected and "y2" in expected)
    has_month = "month" in expected or "start_month" in expected or \
                "end_month" in expected or "m1" in expected or "m2" in expected
    has_year = "year" in expected or "start_year" in expected or \
               "y1" in expected or "y2" in expected
    has_relative = "months" in expected

    if has_day:
        return 4
    if has_range and has_month:
        return 3
    if has_range:
        return 3
    if has_relative:
        return 2
    if has_year and has_month:
        return 2
    if has_year:
        return 1
    return 0


def _compute_category_distance(query: str, expected: dict[str, Any]) -> int:
    """Score how far the query's natural phrasing is from the expected category name."""
    cat = expected.get("category") or expected.get("major_category")
    if cat is None:
        return 0

    q_lower = query.lower()
    cat_lower = str(cat).lower()

    # Exact match in query
    if cat_lower in q_lower:
        return 0

    # Semantic mappings that require domain knowledge.
    # Key = canonical category name (lowercase), value = list of natural-language aliases.
    # Distance 1 = trivial alias (plural, abbreviation, one-word shortening).
    # Distance 2 = genuine semantic leap (returned for anything not matched below).
    semantic_maps = {
        # Food
        "dining":               ["eating out", "eat out", "dine"],
        "combini meal":         ["combini", "combinis", "convenience store"],
        "café":                 ["cafe", "cafes"],
        # Housing and Utilities
        "gas bill":             ["gas"],
        "electricity bill":     ["electricity"],
        "water & sewage bill":  ["water bill"],
        "internet bill":        ["internet", "wifi"],
        "phone bill":           ["phone", "mobile bill"],
        # Transportation
        "flight tickets":       ["flights", "flight"],
        "tokyo metro":          ["metro", "subway"],
        "ride share":           ["rideshare"],
        "shinkansen":           ["bullet train"],
        # Fitness
        "futsal game":          ["futsal"],
        "basketball game":      ["basketball"],
        "football game":        ["football"],
        "sports event":         ["sports events"],
        # Entertainment
        "arcades & karaoke":    ["karaoke", "karaokes", "arcade", "arcades"],
        "events & venues":      ["events", "venue", "venues"],
        "nomikai":              ["nomikais", "work drinks", "work party"],
        # Souvenirs
        "souvenirs/gifts/treats": ["souvenirs and treats", "souvenirs", "gifts"],
        # Household
        "housing and utilities":  ["utilities"],
        # Misc
        "healthcare":           ["medical", "doctor", "hospital"],
        "personal care":        ["hygiene", "toiletries"],
    }

    for canonical, aliases in semantic_maps.items():
        if cat_lower == canonical:
            if any(alias in q_lower for alias in aliases):
                return 1  # Minor mapping (common alias)
    return 2  # Requires real semantic mapping


def _has_relative_time(query: str) -> int:
    """Check if query uses relative time expressions."""
    return 1 if re.search(r"\b(past|last)\s+\d*\s*(month|year|months|years)\b", query.lower()) else 0


def _has_abbreviations(query: str) -> int:
    """Check if query uses abbreviated year forms or informal date notation."""
    q = query.lower()
    # Two-digit years: '24, '25, '26
    if re.search(r"['\s](\d{2})(?:\b|['\s.,])", q):
        return 1
    # Slash notation: 2024/01, 11/2025
    if re.search(r"\d{4}/\d{1,2}|\d{1,2}/\d{4}", q):
        return 1
    return 0


def _count_multi_value_groups(expected: dict[str, Any]) -> int:
    """Count compound parameter groups (e.g., comparison needs 2 date sets)."""
    count = 0
    if "y1" in expected and "y2" in expected:
        count += 1
    if "m1" in expected and "m2" in expected:
        count += 1
    return count


def compute_complexity(tc: dict[str, Any]) -> tuple[int, str]:
    """Compute complexity score and level for a test case.

    Returns: (score, level) where level is 'L1', 'L2', or 'L3'.
    """
    expected = tc["expected"]
    query = tc["q"]

    n_params = len(expected)
    d_date = _compute_date_complexity(expected)
    d_cat = _compute_category_distance(query, expected)
    d_rel = _has_relative_time(query)
    d_multi = _count_multi_value_groups(expected)
    d_abbr = _has_abbreviations(query)

    score = n_params + d_date + d_cat + d_rel + d_multi + d_abbr

    if score <= 4:
        level = "L1"
    elif score <= 7:
        level = "L2"
    else:
        level = "L3"

    return score, level


# ── Test cases ──────────────────────────────────────────────────────────────

_RAW_CASES: list[dict[str, Any]] = [
    # ── Time series (10) ────────────────────────────────────────────────────
    {
        "id": "TS01", "group": "time_series",
        "q": "Can ya show spending on food for past 6 months?",
        "tool": "plot_time_series",
        "expected": {"category": "Food", "months": 6},
    },
    {
        "id": "TS02", "group": "time_series",
        # FIX: removed spurious "for" before "from"
        "q": "plot spend at cafes from june '24 to feb '26",
        "tool": "plot_time_series",
        "expected": {"category": "cafe", "start_year": 2024, "start_month": 6, "end_year": 2026, "end_month": 2},
    },
    {
        "id": "TS03", "group": "time_series",
        "q": "plot spend on snacks for 2024 oct to 2025 dec",
        "tool": "plot_time_series",
        "expected": {"category": "snacks", "start_year": 2024, "start_month": 10, "end_year": 2025, "end_month": 12},
    },
    {
        "id": "TS04", "group": "time_series",
        "q": "show spend at eating out from 2025 june to april 2026",
        "tool": "plot_time_series",
        "expected": {"category": "dining", "start_year": 2025, "start_month": 6, "end_year": 2026, "end_month": 4},
    },
    {
        "id": "TS05", "group": "time_series",
        "q": "plot spend on fitness for past month",
        "tool": "plot_time_series",
        "expected": {"category": "Fitness", "months": 1},
    },
    {
        "id": "TS06", "group": "time_series",
        "q": "plot spend on supplements for past year",
        "tool": "plot_time_series",
        "expected": {"category": "supplements", "months": 12},
    },
    {
        "id": "TS07", "group": "time_series",
        "q": "show spend at combinis for 2024 oct to 2025 dec",
        "tool": "plot_time_series",
        "expected": {"category": "combini meal", "start_year": 2024, "start_month": 10, "end_year": 2025, "end_month": 12},
    },
    {
        "id": "TS08", "group": "time_series",
        "q": "make a plot to show spend on nomikais from 2024/01 to 2026/04",
        "tool": "plot_time_series",
        "expected": {"category": "nomikai", "start_year": 2024, "start_month": 1, "end_year": 2026, "end_month": 4},
    },
    {
        "id": "TS09", "group": "time_series",
        "q": "make a plot to show spend on souvenirs and treats for past year.",
        "tool": "plot_time_series",
        # FIX: lowercased to match sub-category casing convention used throughout suite.
        # validate_and_fix_params maps this up to the major category "Souvenirs/Gifts/Treats".
        "expected": {"category": "souvenirs/gifts/treats", "months": 12},
    },
    {
        "id": "TS10", "group": "time_series",
        "q": "plot spending on gas for past 30 months.",
        "tool": "plot_time_series",
        "expected": {"category": "gas bill", "months": 30},
    },

    # ── Distribution (10) ───────────────────────────────────────────────────
    {
        "id": "DI01", "group": "distribution",
        "q": "show breakdown of education related expenses for 2025...",
        "tool": "plot_distribution",
        "expected": {"category": "Education", "year": 2025},
    },
    {
        "id": "DI02", "group": "distribution",
        "q": "plz share distribuution of food expenses for 2025...",
        "tool": "plot_distribution",
        "expected": {"category": "Food", "year": 2025},
    },
    {
        "id": "DI03", "group": "distribution",
        # FIX: query was "2025/06 to 2025/02" (inverted). Corrected to match expected Feb→Jun.
        "q": "plz share breakdown on expenses related to education for 2025/02 to 2025/06.",
        "tool": "plot_distribution",
        "expected": {"category": "Education", "start_year": 2025, "start_month": 2, "end_year": 2025, "end_month": 6},
    },
    {
        "id": "DI04", "group": "distribution",
        "q": "show breakdown of spend on utilities for the past year",
        "tool": "plot_distribution",
        "expected": {"category": "Housing and Utilities", "months": 12},
    },
    {
        "id": "DI05", "group": "distribution",
        "q": "show breakdown of spend on entertainment for 2024",
        "tool": "plot_distribution",
        "expected": {"category": "Entertainment", "year": 2024},
    },
    {
        "id": "DI06", "group": "distribution",
        "q": "show breakdown of all expenses for 2026 feb",
        "tool": "plot_distribution",
        "expected": {"year": 2026, "month": 2},
    },
    {
        "id": "DI07", "group": "distribution",
        "q": "show breakdown of expenses for 2025 april",
        "tool": "plot_distribution",
        "expected": {"year": 2025, "month": 4},
    },
    {
        "id": "DI08", "group": "distribution",
        "q": "show breakdown of fitness expenses for dec 2024",
        "tool": "plot_distribution",
        "expected": {"category": "Fitness", "year": 2024, "month": 12},
    },
    {
        "id": "DI09", "group": "distribution",
        "q": "tell me breakdown of spend on transportation for past 2 years",
        "tool": "plot_distribution",
        "expected": {"category": "Transportation", "months": 24},
    },
    {
        "id": "DI10", "group": "distribution",
        "q": "show breakdown of food expenses for past 3 months",
        "tool": "plot_distribution",
        "expected": {"category": "Food", "months": 3},
    },

    # ── Comparison bars (10) ────────────────────────────────────────────────
    {
        "id": "CP01", "group": "comparison",
        "q": "compare spend on electricity 2025 vs 26.",
        "tool": "plot_comparison_bars",
        "expected": {"category": "electricity bill", "y1": 2025, "y2": 2026},
    },
    {
        "id": "CP02", "group": "comparison",
        "q": "contrast spending on groceries 2025 jan vs 2026 jan",
        "tool": "plot_comparison_bars",
        "expected": {"category": "grocery", "y1": 2025, "m1": 1, "y2": 2026, "m2": 1},
    },
    {
        "id": "CP03", "group": "comparison",
        "q": "contrast spending at nomikais 2024 vs 25..",
        "tool": "plot_comparison_bars",
        "expected": {"category": "nomikai", "y1": 2024, "y2": 2025},
    },
    {
        "id": "CP04", "group": "comparison",
        "q": "compare spend on gym in nov 2024 vs nov 2025",
        "tool": "plot_comparison_bars",
        "expected": {"category": "gym", "y1": 2024, "m1": 11, "y2": 2025, "m2": 11},
    },
    {
        "id": "CP05", "group": "comparison",
        "q": "compare spend on electricity 24 vs 25",
        "tool": "plot_comparison_bars",
        "expected": {"category": "electricity bill", "y1": 2024, "y2": 2025},
    },
    {
        "id": "CP06", "group": "comparison",
        "q": "compare spend on food for 31 dec 2024 vs same date in 2025",
        "tool": "plot_comparison_bars",
        "expected": {"category": "Food", "y1": 2024, "m1": 12, "d1": 31, "y2": 2025, "m2": 12, "d2": 31},
    },
    {
        "id": "CP07", "group": "comparison",
        "q": "compare spend on flights 2024 vs 2025",
        "tool": "plot_comparison_bars",
        "expected": {"category": "flight tickets", "y1": 2024, "y2": 2025},
    },
    {
        "id": "CP08", "group": "comparison",
        "q": "compare spending on snacks for jan 2025 vs july 2025",
        "tool": "plot_comparison_bars",
        "expected": {"category": "snacks", "y1": 2025, "m1": 1, "y2": 2025, "m2": 7},
    },
    {
        "id": "CP09", "group": "comparison",
        "q": "compare spend on water bill for 2024 dec vs 2025 dec?",
        "tool": "plot_comparison_bars",
        "expected": {"category": "water & sewage bill", "y1": 2024, "m1": 12, "y2": 2025, "m2": 12},
    },
    {
        "id": "CP10", "group": "comparison",
        "q": "compare spend on eating out 2025 vs 2026..",
        "tool": "plot_comparison_bars",
        "expected": {"category": "dining", "y1": 2025, "y2": 2026},
    },

    # ── Calculate total (10) ────────────────────────────────────────────────
    {
        "id": "CT01", "group": "calculate_total",
        "q": "can ya tell total spend on combini food for 2025?",
        "tool": "calculate_total",
        "expected": {"category": "combini meal", "year": 2025},
    },
    {
        "id": "CT02", "group": "calculate_total",
        "q": "tell me total spent on water bill for 2025",
        "tool": "calculate_total",
        "expected": {"category": "water & sewage bill", "year": 2025},
    },
    {
        "id": "CT03", "group": "calculate_total",
        "q": "tell sum spent at karaokes from 2023 to 2026",
        "tool": "calculate_total",
        "expected": {"category": "arcades & karaoke", "start_year": 2023, "end_year": 2026},
    },
    {
        "id": "CT04", "group": "calculate_total",
        "q": "tell me total spent on souvenirs from 2024 to 2025..",
        "tool": "calculate_total",
        "expected": {"category": "souvenirs", "start_year": 2024, "end_year": 2025},
    },
    {
        "id": "CT05", "group": "calculate_total",
        "q": "tell me sum money spent on treats from 2023 to 2026..",
        "tool": "calculate_total",
        "expected": {"category": "treat", "start_year": 2023, "end_year": 2026},
    },
    {
        "id": "CT06", "group": "calculate_total",
        "q": "tell me sum spent on gas for 2024",
        "tool": "calculate_total",
        "expected": {"category": "gas bill", "year": 2024},
    },
    {
        "id": "CT07", "group": "calculate_total",
        "q": "can ya sum total spent on metro for 2024 july?",
        "tool": "calculate_total",
        # FIX: was "Tokyo Metro" (title case). Lowercased to match all other sub-categories.
        "expected": {"category": "tokyo metro", "year": 2024, "month": 7},
    },
    {
        "id": "CT08", "group": "calculate_total",
        "q": "Can ya tell total spend on food for past month?",
        "tool": "calculate_total",
        "expected": {"category": "Food", "months": 1},
    },
    {
        "id": "CT09", "group": "calculate_total",
        "q": "can ya sum total spend on snacks for past 6 months?",
        "tool": "calculate_total",
        "expected": {"category": "snacks", "months": 6},
    },
    {
        "id": "CT10", "group": "calculate_total",
        "q": "can ya tell me total spend at combinis in 2025?",
        "tool": "calculate_total",
        "expected": {"category": "combini meal", "year": 2025},
    },

    # ── Top expenses (10) ───────────────────────────────────────────────────
    {
        "id": "TP01", "group": "top_expenses",
        "q": "can ya get me top 5 expenses for 31 dec 2025?",
        "tool": "get_top_expenses",
        "expected": {"n": 5, "year": 2025, "month": 12, "day": 31},
    },
    {
        "id": "TP02", "group": "top_expenses",
        "q": "tell me top 8 expenses for 11/2025..",
        "tool": "get_top_expenses",
        "expected": {"n": 8, "year": 2025, "month": 11},
    },
    {
        "id": "TP03", "group": "top_expenses",
        "q": "can ya tell me the top 3 expenses for 2024?",
        "tool": "get_top_expenses",
        "expected": {"n": 3, "year": 2024},
    },
    {
        "id": "TP04", "group": "top_expenses",
        "q": "can ya get me top 10 eating out expenses in 2025?",
        "tool": "get_top_expenses",
        "expected": {"n": 10, "category": "dining", "year": 2025},
    },
    {
        "id": "TP05", "group": "top_expenses",
        "q": "tell me the top 4 expenses from 2023 to 2026.",
        "tool": "get_top_expenses",
        "expected": {"n": 4, "start_year": 2023, "end_year": 2026},
    },
    {
        "id": "TP06", "group": "top_expenses",
        "q": "what were the top 5 expenses for past month? disregard rent",
        "tool": "get_top_expenses",
        "expected": {"n": 5, "months": 1, "ignore_rent": True},
    },
    {
        "id": "TP07", "group": "top_expenses",
        "q": "tell me top 10 expenses of 2025 nov w/o rent",
        "tool": "get_top_expenses",
        "expected": {"n": 10, "year": 2025, "month": 11, "ignore_rent": True},
    },
    {
        "id": "TP08", "group": "top_expenses",
        "q": "can ya tell me top 7 futsal expenses for 2025?",
        "tool": "get_top_expenses",
        "expected": {"n": 7, "category": "futsal game", "year": 2025},
    },
    {
        "id": "TP09", "group": "top_expenses",
        "q": "can ya tell me about the top 3 expenses on clothing in 2024?",
        "tool": "get_top_expenses",
        "expected": {"n": 3, "category": "clothing", "year": 2024},
    },
    {
        "id": "TP10", "group": "top_expenses",
        "q": "tell me about top 10 expenses of last year but exclude rent tho",
        "tool": "get_top_expenses",
        "expected": {"n": 10, "months": 12, "ignore_rent": True},
    }
]

# ── Compute complexity and build final TEST_CASES ───────────────────────────

TEST_CASES: list[dict[str, Any]] = []
for tc in _RAW_CASES:
    score, level = compute_complexity(tc)
    TEST_CASES.append({
        **tc,
        "complexity_score": score,
        "difficulty": level,
    })