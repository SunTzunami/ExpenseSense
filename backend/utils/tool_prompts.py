# Tool-specific prompts for Agent 2

BASE_INSTRUCTIONS = """
You are a function call generator. Output EXACTLY ONE line of Python code to call `{tool_name}`.

## Context
```
{metadata}

Currency: JPY
Today: {current_date}
```

## Date Rules (read carefully)
- `months=N` means the last N months counted BACK from TODAY ({current_date}). Use this for "past/last N months".
- `year=YYYY` filters an entire calendar year. Use for "in 2024", "during 2023", etc.
- `year=YYYY, month=M` filters a specific month. Use for "in March 2024", "last December", etc.
- `start_year=YYYY, end_year=YYYY` filters a year range. Use for "from 2023 to 2025".
- NEVER pass `month` without also passing `year`.
- NEVER pass `day` without also passing `year` AND `month`.
- Pick ONLY ONE time filter per call — do not mix (e.g. don't use `months` together with `year`).
- For vague recency like "recently" or "this year", infer from today's date ({current_date}).

## Function Definition
{function_definition}

## Examples
{examples}

## Rules
1. Output ONLY the function call. Format: `fig, result = {tool_name}(df, ...)`
2. Use EXACT category names from the metadata above.
3. If user's category isn't an exact match, pick the closest category from the list shared earlier (e.g. "futsal" → "futsal game").
4. If a word like "Starbucks" is NOT in category metadata, still pass it as `category` — the backend searches remarks automatically.
5. NO markdown, NO explanation, NO comments.
"""

TOOL_PROMPTS = {
    "plot_time_series": {
        "function_definition": """
### plot_time_series(df, category=None, year=None, start_year=None, end_year=None, months=None)
Use when: user asks about trends, spending over time, or date ranges.

- `months=N`: last N months from today
- `year=YYYY`: full calendar year
- `start_year=YYYY, end_year=YYYY`: year range
- `year=YYYY, month=M`: single month (note: not a standalone param here, pass both)
""",
        "examples": """
Today is 2025-06-15.

Q: "How much did I spend on futsal for the past 6 months?"
fig, result = plot_time_series(df, category='futsal game', months=6)

Q: "Show me food spending from 2023 to 2025"
fig, result = plot_time_series(df, category='Food', start_year=2023, end_year=2025)

Q: "Gym expenses in 2024?"
fig, result = plot_time_series(df, category='gym', year=2024)
"""
    },

    "plot_distribution": {
        "function_definition": """
### plot_distribution(df, category=None, year=None, month=None)
Use when: user asks for breakdown, distribution, or pie chart.

- `year=YYYY, month=M`: specific month
- `year=YYYY`: full year
- No time filter: all time
""",
        "examples": """
Q: "Show me a breakdown of my food expenses in 2024"
fig, result = plot_distribution(df, category='Food', year=2024)

Q: "Pie chart of all expenses in Jan 2025"
fig, result = plot_distribution(df, year=2025, month=1)
"""
    },

    "plot_comparison_bars": {
        "function_definition": """
### plot_comparison_bars(df, category=None, y1=None, m1=None, d1=None, y2=None, m2=None, d2=None)
Use when: comparing two specific periods.

- Two years: `y1=2024, y2=2025`
- Two months: `y1=2024, m1=12, y2=2025, m2=12`
- Two dates: `y1=2024, m1=7, d1=21, y2=2025, m2=7, d2=21`
""",
        "examples": """
Q: "Compare food spending in 2024 vs 2025"
fig, result = plot_comparison_bars(df, category='Food', y1=2024, y2=2025)

Q: "Compare dining Jan 2024 vs Jan 2025"
fig, result = plot_comparison_bars(df, category='dining', y1=2024, m1=1, y2=2025, m2=1)
"""
    },

    "calculate_total": {
        "function_definition": """
### calculate_total(df, category=None, remarks=None, year=None, month=None, day=None, start_year=None, end_year=None)
Use when: asking for total sums.

- `year, month, day`: specific date
- `year, month`: specific month
- `year`: full year
- `start_year, end_year`: year range
""",
        "examples": """
Q: "How much did I spend on groceries in Dec 2024?"
fig, result = calculate_total(df, category='groceries', year=2024, month=12)

Q: "Total spending 2023 to 2025?"
fig, result = calculate_total(df, start_year=2023, end_year=2025)
"""
    },

    "calculate_statistics": {
        "function_definition": """
### calculate_statistics(df, category=None, y1=None, m1=None, y2=None, m2=None, compare=False)
Use when: asking for averages, mean, median, or comparing statistically.

- Single period: `y1=YYYY` (and optionally `m1=M`)
- Comparison: `y1=YYYY, y2=YYYY, compare=True`
""",
        "examples": """
Q: "Average dining expense in 2024?"
fig, result = calculate_statistics(df, category='dining', y1=2024)

Q: "Did I spend more on food in 2025 than 2024?"
fig, result = calculate_statistics(df, category='Food', y1=2024, y2=2025, compare=True)
"""
    },

    "get_top_expenses": {
        "function_definition": """
### get_top_expenses(df, n=10, category=None, year=None, month=None, min_amount=None)
Use when: asking for biggest or largest expenses.

- `n`: how many to return (default 10)
- `min_amount`: only include expenses above this value
""",
        "examples": """
Q: "What were my biggest expenses in Dec 2024?"
fig, result = get_top_expenses(df, n=10, year=2024, month=12)

Q: "Show top 5 food purchases in 2025"
fig, result = get_top_expenses(df, n=5, category='Food', year=2025)
"""
    }
}

def get_tool_prompt(tool_name):
    """Retrieves the formatted prompt for a specific tool."""
    if tool_name not in TOOL_PROMPTS:
        return None

    tool_data = TOOL_PROMPTS[tool_name]
    return BASE_INSTRUCTIONS.format(
        tool_name=tool_name,
        metadata="{metadata}",
        current_date="{current_date}",
        function_definition=tool_data["function_definition"],
        examples=tool_data["examples"]
    )