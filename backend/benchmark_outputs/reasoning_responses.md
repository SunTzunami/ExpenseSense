# Responses with Reasoning/Sentences Instead of Tool Calls

This document lists all instances from the `run_5reps_combined.csv` dataset where models produced conversational reasoning, conversational apologies, or textual explanations instead of a valid structured tool call or routing JSON.

---

## 1. LFM2-1.2B (Dual Mode) — Conversational Routing

In **20 instances** (primarily on test case **DI03**), instead of outputting a clean tool name, the router agent in the dual architecture generated a full paragraph of reasoning explaining which tool it *would* use.

### Examples:
* **Row 4730 (TC: DI03)** — *Question: "plz share breakdown on expenses related to education for 2025/02 to 2025/06."*
  > "To answer the user's question about a breakdown of expenses related to education for 2025/02 to 2025/06, I would use **`plot_comparison_bars`** tool. This tool is specifically designed for comparing two different time periods, which fits the user's request perfectly."
* **Row 4731 (TC: DI03)** — *Question: "plz share breakdown on expenses related to education for 2025/02 to 2025/06."*
  > "To answer the user's question about a breakdown of education expenses for 2025/02 to 2025/06, I would use **`plot_distribution`**. This tool is designed for creating distribution plots, which would allow us to visualize how education expenses are spread across different categories or amounts within the specified timeframe."

---

## 2. MiniCPM5-1B (Dual Mode) — Conversational Refusals

In **4 instances** (on test case **DI12**), the specialist agent in the dual architecture generated a conversational apology explaining its lack of capabilities, rather than extracting parameters.

### Examples:
* **Row 5348 (TC: DI12)** — *Question: "gimme a pie chart of accomodation expenses from 2024 - 25"*
  > "I'm sorry, but I can't provide a pie chart as it's a visual element and not a parameter I can extract from the user's request. I can only provide information about the available parameters and their meanings."
* **Row 5349 (TC: DI12)** — *Question: "gimme a pie chart of accomodation expenses from 2024 - 25"*
  > "I'm sorry, but I don't have the capability to generate a pie chart. My current function is limited to providing data in JSON format. I can help you extract parameters from your request, but I cannot create visual representations like charts."

---

## Why this happens

1. **Prompt Instruction Violations**: These small models (< 1.5B) are highly susceptible to "instruction drift" when they encounter questions requesting visual formatting (like "pie chart" or "breakdown").
2. **Context Confusion**: When the user asks for a visual style ("breakdown", "pie chart"), the models drop their JSON-only constraint and attempt to converse with the user directly, either trying to explain their logic (LFM2 routing) or explaining their limitations (MiniCPM specialist).
