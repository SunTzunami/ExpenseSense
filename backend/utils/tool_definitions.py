from typing import List, Dict, Any

# Tool definitions for FunctionGemma integration
# These schemas mirror the functions in analysis_tools.py

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "plot_time_series",
            "description": "Plots a time series chart of expenses. Can filter by category, year, range of years, or recent months. Returns a figure and a summary message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category to filter by. Can be a specific category (e.g. 'grocery') or a broad group (e.g. 'Food')."
                    },
                    "year": {
                        "type": "integer",
                        "description": "Specific year to plot (e.g., 2024)."
                    },
                    "start_year": {
                        "type": "integer",
                        "description": "Start year for a range query."
                    },
                    "end_year": {
                        "type": "integer",
                        "description": "End year for a range query."
                    },
                    "months": {
                        "type": "integer",
                        "description": "Number of recent months to include."
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional custom title for the plot."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "plot_pie_chart",
            "description": "Plots a pie chart showing expense breakdown. Can show major categories, or sub-categories within a major category or specific category.",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {
                        "type": "integer",
                        "description": "Year to filter data by."
                    },
                    "category": {
                        "type": "string",
                        "description": "Category or Major Category to show breakdown for. If omitted, shows all major categories."
                    },

                    "title": {
                        "type": "string",
                        "description": "Optional custom title."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "plot_comparison",
            "description": "Plots a comparison between two years for a category or major category using box plots and stats.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category or Major Category to compare."
                    },
                    "y1": {
                        "type": "integer",
                        "description": "First year to compare."
                    },
                    "y2": {
                        "type": "integer",
                        "description": "Second year to compare."
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional custom title."
                    }
                },
                "required": ["y1", "y2"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "plot_stacked_bar",
            "description": "Plots a stacked bar chart showing breakdown over time (monthly or yearly comparison).",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {
                        "type": "integer",
                        "description": "Year for monthly breakdown mode."
                    },
                    "y1": {
                        "type": "integer",
                        "description": "First year for yearly comparison mode."
                    },
                    "y2": {
                        "type": "integer",
                        "description": "Second year for yearly comparison mode."
                    },
                    "mode": {
                        "type": "string",
                        "enum": ["monthly", "yearly"],
                        "description": "Mode of the chart: 'monthly' for one year, 'yearly' for comparing two years."
                    },
                    "title": {
                        "type": "string",
                        "description": "Optional custom title."
                    }
                },
                "required": ["mode"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_sum",
            "description": "Calculates the total sum of expenses matching the criteria.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category or Major Category to sum."
                    },
                    "year": {
                        "type": "integer",
                        "description": "Year to filter by."
                    },
                    "remarks": {
                        "type": "string",
                        "description": "Text to search for in remarks (e.g., 'starbucks')."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_average",
            "description": "Calculates the average expense transaction amount matching the criteria.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category or Major Category to average."
                    },
                    "year": {
                        "type": "integer",
                        "description": "Year to filter by."
                    },
                    "remarks": {
                        "type": "string",
                        "description": "Text to search for in remarks."
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_significance_test",
            "description": "Runs a statistical significance test (t-test) on spending between two years.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {
                        "type": "string",
                        "description": "Category or Major Category to test."
                    },
                    "y1": {
                        "type": "integer",
                        "description": "First year."
                    },
                    "y2": {
                        "type": "integer",
                        "description": "Second year."
                    }
                },
                "required": ["y1", "y2"]
            }
        }
    }
]
