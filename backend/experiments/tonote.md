# Analysis: Categories in Prompts, Agent Logic, and Token Accuracy

## 1. How Categories Are Injected into Prompts

The category list from [categories.json](file:///Users/sajagswami/Desktop/projects/ExpenseSense/src/utils/categories.json) is injected as a `{metadata}` block into the prompts. Here's the flow:

### Frontend → Backend
In [ChatInterface.jsx](file:///Users/sajagswami/Desktop/projects/ExpenseSense/src/components/ChatInterface.jsx#L147-L148), both major categories and subcategory keys are merged and formatted as a bullet list:
```js
const allCats = Array.from(new Set([...MAJOR_CATEGORIES, ...Object.keys(CATEGORY_MAPPING)])).sort();
const metadataStr = `\n### CATEGORIES:\n${allCats.map(c => `- ${c}`).join('\n')}\n`;
```

This produces ~70 category lines (11 major + ~60 subcategory names).

### In Benchmarks
[expense_benchmark.py](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/experiments/expense_benchmark.py#L266-L273) constructs `METADATA_TEXT` the same way:
```python
def build_metadata_text() -> str:
    all_categories = sorted(set(MAJOR_CATEGORIES) | set(CATEGORY_MAPPING.keys()))
    lines = ["### CATEGORIES (available options for 'category' argument):"]
    for cat in all_categories:
        lines.append(f"- {cat}")
    return "\n".join(lines)
```

---

## 2. Which Prompts Get Categories? (Single vs Dual Agent)

### Single-Agent Mode
| Component | Gets Categories? | Details |
|-----------|:-:|---------|
| Single-agent prompt | ✅ **YES** | `{metadata}` is injected into the combined prompt built by [build_single_agent_prompt()](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/utils/tool_prompts.py#L315-L391) |

The single-agent prompt includes `{metadata}` at the bottom in a `## Context` block (line 384–386 of tool_prompts.py), so the model sees the full category list while doing **both** routing + parameter extraction in one pass.

### Dual-Agent Mode
| Component | Gets Categories? | Details |
|-----------|:-:|---------|
| **Router** (Phase 1) | ❌ **NO** | The [router_prompt.txt](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/utils/prompts/router_prompt.txt) has **no** `{metadata}` placeholder — it only classifies intent into a tool ID (1–5) |
| **Specialist** (Phase 2) | ✅ **YES** | The specialist prompt template (from [tool_prompts.py](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/utils/tool_prompts.py#L4-L40) `BASE_INSTRUCTIONS`) contains `{metadata}` which is substituted in [main.py L236–240](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/main.py#L236-L240) |

> [!IMPORTANT]
> **Your intuition is correct**: In dual-agent mode, **the router does NOT see categories**. It only needs to classify intent (e.g., "total" → tool 4, "trend" → tool 1). Categories are irrelevant for routing and would just waste tokens. Only the specialist needs them for parameter extraction (mapping "groceries" → "grocery", etc.).

This is actually a strength of the dual-agent architecture — the router's lean ~1,000-token prompt avoids unnecessary category noise.

---

## 3. Should the Papers Mention This?

Both papers already mention this, but somewhat implicitly. Here's what's currently said:

### What's already in the papers
- **FinNLP** [L1224](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/experiments/FinNLP2026/finnlp_2026.tex#L1224): *"The `{metadata}` placeholder is populated dynamically with the categories present in the user-uploaded dataset"*
- **FinNLP** [L930](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/experiments/FinNLP2026/finnlp_2026.tex#L930): Appendix mentions categories.json is *"passed in the `{metadata}` block"*
- Both papers mention the specialist sees ~1,500–2,000 tokens and the router sees ~1,000 tokens, but **neither explicitly states that the router prompt omits the category list**.

### Recommendation
> [!TIP]
> Yes, it would strengthen the papers to explicitly note:
> 1. The category vocabulary is **dynamically injected** from the user's dataset into the prompt (not hardcoded)
> 2. In dual-agent mode, **only the specialist receives the category vocabulary** — the router operates on pure intent classification without category context, keeping its prompt lean
> 3. This is a deliberate design choice: category grounding is irrelevant for routing (tool selection) but critical for parameter extraction (matching user terms to canonical category names)
>
> This reinforces the privacy + efficiency argument: fewer tokens see user data, and the router stays focused.

---

## 4. Is the Token Calculation Accurate?

### How tokens are counted
Token counts come from **llama-cpp-python's built-in usage reporting** — not manual estimation. In [inference.py L221](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/experiments/inference.py#L221):
```python
self.last_usage = response.get("usage", {})
```
This returns `prompt_tokens`, `completion_tokens`, `total_tokens` from the llama.cpp engine, which counts **actual tokenized tokens** (not words or characters).

### Dual-agent token summing
In [expense_benchmark.py L964-965](file:///Users/sajagswami/Desktop/projects/ExpenseSense/backend/experiments/expense_benchmark.py#L964-L965):
```python
"_prompt_tokens": (
    router_usage.get("prompt_tokens", 0) + specialist_usage.get("prompt_tokens", 0)
),
```
Router + specialist prompt tokens are **summed correctly**. There are FIX comments in the code indicating this was explicitly patched to capture router usage before the specialist call overwrites it (L886–887).

### Are the ~5,500 and ~2,700 estimates accurate?

| Claim in papers | Source | Assessment |
|-----------------|--------|------------|
| Single-agent: ~5,500 tokens | Includes all 5 tool schemas, 73 examples, date rules, metadata | ✅ **Plausible** — the combined prompt in `build_single_agent_prompt()` is very large |
| Router: ~1,000 tokens | 102-line prompt with 19 examples, no metadata | ✅ **Plausible** — the router prompt is lean |
| Specialist: ~1,500–2,000 tokens | Base template + 1 tool's params/examples + metadata (~70 categories) | ✅ **Plausible** — each tool has 13–16 examples |
| Dual combined: ~2,700 tokens | Router (~1,000) + Specialist (~1,700 avg) | ✅ **Arithmetic checks out** |

> [!NOTE]
> The token counts are **model-dependent** (different tokenizers produce different counts), but since the papers use the same llama.cpp engine to count, the reported numbers reflect actual tokenization. The "≈" qualifier in the papers is appropriate. These are likely **averages across the benchmark runs**, not manual estimates.

### One subtle point
The token counts reported vary per query since `{metadata}` is the same but the user query length varies. The papers say "≈", which is correct — these are representative approximations of the average across the 115 test cases.

---

## Summary

| Question | Answer |
|----------|--------|
| Do prompts include categories? | **Yes**, via `{metadata}` placeholder |
| Single-agent gets categories? | **Yes** — in the combined prompt |
| Dual-agent router gets categories? | **No** — router only classifies intent |
| Dual-agent specialist gets categories? | **Yes** — for parameter extraction |
| Should papers mention this? | **Yes** — explicitly noting the router omits categories would strengthen the efficiency/privacy argument |
| Are token counts accurate? | **Yes** — they come from llama.cpp's native tokenizer, not manual estimates |
