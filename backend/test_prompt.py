import re
from typing import Optional

# mock imports
class mock_tool_prompts:
    BASE_INSTRUCTIONS = """You are an automated API parameter extractor. Your ONLY purpose is to extract parameters from the user's request and output a SINGLE JSON object containing those parameters.

## CRITICAL RULES (READ CAREFULLY)
1. DO NOT write any Python code or function calls. DO NOT import anything.
2. DO NOT wrap the output in markdown. NO backticks (```).
3. Output EXACTLY and ONLY a JSON object representing the parameters. E.g. {{"category": "Food", "months": 6}}
4. Use EXACT category names from the metadata below. If not an exact match, map it to the closest valid category (e.g. 'groceries' -> 'grocery', 'dining out' -> 'dining').

## Date Rules
- `months=N`: RELATIVE duration
- Fractional years: convert to months.

## Available Parameters
{parameters}

## Examples
{examples}

## Context
```
{metadata}
```
Currency: JPY
Today: {current_date}

FINAL REMINDER: Output ONLY the JSON object. NO MARKDOWN, NO BACKTICKS, NO EXPLANATION, NO CODE!
"""
    TOOL_PROMPTS = {
        "plot_time_series": {
            "parameters": "category (str), months (int)",
            "examples": """Q: "How much?"\n{"category": "futsal", "months": 6}\n\nQ: "Empty?"\n{}"""
        }
    }

ROUTER_PROMPT = """You are an expert intent classifier.

## Available Tools

1. **`plot_time_series`** (ID: 1)
   - Use when user asks about: trends.

2. **`plot_distribution`** (ID: 2)
   - Use when user asks for: breakdown.

## Output Format
Output ONLY the tool number (1-5).
"""

def build_single_agent_prompt(metadata: str, current_date: str, model_id: Optional[str] = None) -> str:
    # 1. Extract "Available Tools" from ROUTER_PROMPT
    tools_match = re.search(r"(## Available Tools.*?)(?=## Output Format|$)", ROUTER_PROMPT, re.DOTALL)
    available_tools_text = tools_match.group(1).strip() if tools_match else "## Available Tools\n1. plot_time_series (1)\n2. plot_distribution (2)\n3. plot_comparison_bars (3)\n4. calculate_total (4)\n5. get_top_expenses (5)"
    
    # 2. Extract base rules from BASE_INSTRUCTIONS
    base_instructions_text = mock_tool_prompts.BASE_INSTRUCTIONS.replace(
        "{{\"category\": \"Food\", \"months\": 6}}",
        "{{\"tool\": 1, \"category\": \"Food\", \"months\": 6}}"
    )
    base_rules_match = re.search(r"(.*?)(?=## Available Parameters)", base_instructions_text, re.DOTALL)
    base_rules = base_rules_match.group(1).strip() if base_rules_match else base_instructions_text
    base_rules = base_rules.replace("{{", "{").replace("}}", "}")
    
    # 3. Build the combined examples and parameters
    tool_map = {
        "plot_time_series": 1,
        "plot_distribution": 2,
        "plot_comparison_bars": 3,
        "calculate_total": 4,
        "get_top_expenses": 5
    }
    
    combined_examples = []
    parameters_text = []
    for tool_name, tool_id in tool_map.items():
        if tool_name in mock_tool_prompts.TOOL_PROMPTS:
            params = mock_tool_prompts.TOOL_PROMPTS[tool_name]["parameters"]
            parameters_text.append(f"{tool_id}. `{tool_name}`: {params}")
            
            examples_str = mock_tool_prompts.TOOL_PROMPTS[tool_name]["examples"]
            def replace_json(match):
                inner = match.group(1)
                if not inner.strip():
                    return f'{{"tool": {tool_id}}}'
                return f'{{"tool": {tool_id}, {inner}}}'
            
            modified_examples = re.sub(r'^\{([^}]*)\}$', replace_json, examples_str, flags=re.MULTILINE)
            combined_examples.append(f"### Tool {tool_id} ({tool_name}) Examples:\n{modified_examples}")
            
    all_examples = "\n\n".join(combined_examples)
    all_parameters = "\n".join(parameters_text)
    
    prompt = f"""{base_rules}

Your task is to determine which ONE tool is best suited to answer the user's question AND extract the required parameters.
You must output a single JSON object containing:
1. "tool": The numeric ID (1-5) of the best tool suited for the query.
2. The parameters for that tool.

{available_tools_text}

## PARAMETERS DEFINITIONS FOR EACH TOOL
{all_parameters}

## Examples
{all_examples}

## Context
```
{metadata}
```
Currency: JPY
Today: {current_date}

FINAL REMINDER: Output ONLY the JSON object. NO MARKDOWN, NO BACKTICKS, NO EXPLANATION, NO CODE!
"""
    return prompt

print(build_single_agent_prompt("METADATA", "2024-01-01"))
