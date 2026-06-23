# Why Some Models Have Single-Digit Accuracy

## Summary

Three models show abysmal performance: **EXAONE 1.2B** (~9%), **LFM2 1.2B** (~9%), and **Gemma-3 1B** (~30%) in single-agent mode. The root cause for all three is the same fundamental problem: **the models are overwhelmed by the long single-agent prompt (~5,300–5,900 tokens) and degenerate into producing a single EOS token instead of a real response.**

---

## The Smoking Gun: 1-Token Outputs

| Model | Mode | Prompt Tokens | Avg Completion Tokens | % with exactly 1 token | Task Acc |
|-------|------|:---:|:---:|:---:|:---:|
| **EXAONE 1.2B** | single | ~5,905 | **1.1** | **99.7%** | 8.9% |
| **LFM2 1.2B** | single | ~5,302 | **1.0** | **100%** | 8.7% |
| **Gemma-3 1B** | single | ~5,699 | 23.2 | **40.3%** | 30.0% |
| EXAONE 1.2B | dual | ~2,925 | 4.2 | 0% | 37.8% |
| LFM2 1.2B | dual | ~2,662 | 8.1 | 0% | 25.7% |
| Gemma-3 1B | dual | ~2,695 | 28.1 | 0% | 51.7% |
| Qwen3.5 0.8B | single | ~5,613 | 32.3 | 0% | 79.8% |
| Qwen3.5 2B | single | ~5,613 | 35.3 | 0% | 92.0% |

> [!CAUTION]
> **EXAONE and LFM2 produce a single token (EOS) on virtually every single-agent query.** They aren't "thinking wrong" — they're **not thinking at all.**

---

## Root Cause Analysis

### 1. EXAONE 1.2B (single: 8.9%)

**What's happening:** 573 out of 575 attempts produce exactly **1 completion token** — the model immediately emits an end-of-sequence token without generating any JSON response. The timing confirms this:
- First request: **18.4 seconds** (model loading + prompt ingestion)
- All subsequent requests: **~0.086 seconds** (KV cache hit → instant EOS)

The model loads the ~5,900-token prompt, processes it, and immediately concludes it has nothing to say. The only 2 correct responses (out of 575) occurred when the model briefly "woke up" and produced 18–20 tokens.

**Why it performs better in dual mode (37.8%):** The dual-agent router prompt is only ~2,925 tokens. At this shorter context, EXAONE can at least generate *some* output (avg 4.2 tokens), though it still mostly produces incomplete parameter sets (87% `PARAM_MISSING` errors).

### 2. LFM2 1.2B (single: 8.7%)

**What's happening:** An even more extreme case — **100% of all 575 attempts produce exactly 1 completion token.** Zero exceptions. The model takes a consistent ~7.67 seconds per request (suggesting full prompt re-processing each time without effective KV caching), but the output is always a single EOS.

The parser defaults this empty output to `calculate_total` with no params, which happens to be correct for ~45% of the `calculate_total` test cases (giving it its only source of accuracy).

**Why it performs better in dual mode (25.7%):** With the shorter ~2,662-token router prompt, LFM2 can produce 2+ tokens (median=2), enough to sometimes get the tool ID right. But even then, 53% of errors are `PARAM_MISSING` — it generates a tool number but not the parameters.

### 3. Gemma-3 1B (single: 30.0%)

**Gemma is a partially-working case**, not a total collapse:
- **40.3%** of attempts produce 1 token (→ defaults to `calculate_total`)
- **59.7%** produce a real response (18–78 tokens), but with frequent errors

When Gemma *does* generate, its outputs show it's using **tool index numbers** (`"tool": 4`, `"tool": 5`) instead of tool names, suggesting it partially understood the prompt's tool descriptions but is mapping them by position rather than by name. Many of its "working" responses also include hallucinated extra parameters (`day`, `n`, etc.) that don't exist in the tool schema.

---

## Why Only These Models Fail

The pattern is clear: **this is a model capacity × context length interaction**.

```
Model Size vs Single-Agent Performance
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Qwen3.5 2B      → 92.0% ✅ (handles 5,600 tokens fine)
Qwen3.5 0.8B    → 79.8% ✅ (smaller but still works)  
MiniCPM 1B      → 62.3% ⚠️ (works but less accurately)
Gemma-3 1B      → 30.0% ❌ (intermittent collapse)
LFM2 1.2B       →  8.7% ❌ (total collapse)
EXAONE 1.2B     →  8.9% ❌ (total collapse)
```

The single-agent prompt is **~5,300–5,900 tokens** — this is a heavy cognitive load for sub-2B models. The models that fail (EXAONE, LFM2, Gemma) simply don't have enough capacity to:
1. Process such a long, instruction-dense system prompt
2. Maintain attention over the full context
3. Generate a structured JSON response conforming to the schema

They "give up" by emitting EOS immediately. This is a well-known failure mode in small language models when the prompt approaches or exceeds their effective context capacity (distinct from their raw context window size).

> [!IMPORTANT]
> The `n_ctx=8192` context window is technically large enough, but **effective context utilization** in small models is much shorter than their theoretical maximum. A 1B model with 8K context may only reliably attend to ~2K–3K tokens.

---

## Rep-Level Stability Confirms Deterministic Collapse

| Model | Mode | All 5 Reps Same | All 5 Wrong | All 5 Correct |
|-------|------|:---:|:---:|:---:|
| EXAONE 1.2B | single | **98%** | **80%** | 0% |
| LFM2 1.2B | single | **100%** | **81%** | 0% |
| Gemma-3 1B | single | 91% | 44% | 1% |
| Qwen3.5 2B | single | 90% | 0% | 56% |

EXAONE and LFM2 are **deterministically wrong** — the same failure on every single repetition, confirming this is a systematic model limitation, not random noise.

---

## The "Accidental Accuracy"

Both EXAONE and LFM2 score ~9% rather than 0% because:
- The parser defaults empty/single-token outputs to `calculate_total` with `{}`
- The `calculate_total` task group has ~23 test cases
- ~45% of `calculate_total` cases accept minimal parameters (e.g., "how much did I spend total?")
- So they get **~45% × 20% (proportion of calculate_total TCs) ≈ 9%** "for free"

This is not real intelligence — it's a favorable parser default combined with forgiving test cases.

---

## Bottom Line

These models aren't "bad at the task" — they're **catatonic when given the single-agent prompt**. The prompt is simply too long and complex for their capacity. The dual-agent architecture partly solves this by splitting the work into a shorter router prompt (~2,700 tokens) + a focused specialist prompt, which is why all models perform significantly better in dual mode.
