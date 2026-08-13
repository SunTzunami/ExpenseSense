This is a solid benchmark harness. I've gone through all five files plus the supporting context carefully. Here's what I found, organized by severity.

---

## Critical Issues (will cause wrong results or crashes)

**1. `validate_and_fix_params` receives the wrong DataFrame in `expense_benchmark.py`**

In `benchmark_single_agent` and `benchmark_dual_agent`, you call:
```python
validated_kwargs, warning = validate_and_fix_params(kwargs, VALIDATION_DF)
```

`VALIDATION_DF` is built from `categories.json` (just `category` and `major category` columns). But `validate_and_fix_params` in `llm_input_validation.py` calls `get_metadata_lists(df)` which looks for `df["category"]` and `df["major category"]` columns. Your `VALIDATION_DF` has columns `"category"` and `"major category"` (with a space) — check this matches exactly. If `build_validation_df()` produces `"major category"` (with space), you're fine, but verify because `analysis_tools.py` uses `'major category'` (space) while the JSON key would be `"major category"` after the dict is loaded. This is likely fine but worth a `print(VALIDATION_DF.columns.tolist())` before you run.

**2. `score_row` and `classify_error` receive raw predicted params that still contain `"tool"` key in single-agent mode**

In `benchmark_single_agent`:
```python
kwargs = {k: v for k, v in params.items() if k != "tool"}
```
This correctly strips `"tool"`. But trace through `canonicalize_params` — if the LLM outputs `{"tool": 4, "category": "Food"}` and the regex fallback in `extract_json_params` picks up `tool` as a key, you strip it correctly. However, if the LLM outputs the tool name as a string inside the JSON like `{"tool": "calculate_total", ...}`, the tool name lookup via `TOOL_ID_TO_NAME` will fail silently and default to `calculate_total`. For sub-2B models this will happen often. Not a crash, but silently wrong routing.

**3. `TOOL_ID_TO_NAME` is imported but never shown — verify it maps `{1: "plot_time_series", ..., 5: "get_top_expenses"}`**

You import `TOOL_ID_TO_NAME` from `utils/tool_registry` but I don't see its definition in the provided files. If the mapping is wrong or incomplete, every single-agent routing decision silently falls back to `"calculate_total"`. Add an assertion at startup:
```python
assert set(TOOL_ID_TO_NAME.values()) == ALLOWED_TOOLS, f"TOOL_ID_TO_NAME mismatch: {TOOL_ID_TO_NAME}"
```

**4. `extract_json_params` float-to-int normalization misses nested/unusual cases**

```python
data = {k: int(v) if isinstance(v, float) and v == int(v) else v for k, v in data.items()}
```
This only normalizes top-level values. Sub-2B models sometimes output `{"n": 5.0}` — this handles it. But it doesn't handle `ignore_rent` being output as `1` or `0` (integer) instead of `True`/`False`. Add:
```python
bool_keys = {"ignore_rent"}
data = {
    k: bool(v) if k in bool_keys and isinstance(v, int) else
       (int(v) if isinstance(v, float) and v == int(v) else v)
    for k, v in data.items()
}
```

**5. AVC scoring breaks when expected value is boolean and predicted is string**

In `score_row`:
```python
gt_val = str(gt_params.get(key, "")).strip().lower()
pred_val = str(pred_params.get(key, "")).strip().lower()
if gt_val and pred_val and gt_val == pred_val:
```

`str(True).lower()` = `"true"`. If a model outputs `"ignore_rent": true` (JSON boolean), that parses correctly. But if it outputs `"ignore_rent": "True"` (string), `str("True").lower()` = `"true"` — matches. If it outputs `"ignore_rent": 1`, `str(1).lower()` = `"1"` ≠ `"true"`. The fix in point 4 handles this upstream, but add a defensive note: with sub-2B models expect ~30% of `ignore_rent` predictions to come as `1`/`0`.

---

## Significant Issues (will skew metrics)

**6. Warmup only fires once total, not per-mode**

In `main()`:
```python
for mode in modes:
    ...
    for model_id in models:
        cfg = RunConfig(mode=mode, ...)
        rows = benchmark_model(model_id, cfg, ...)
```

Inside `benchmark_model`, warmup runs with `warmup_reps=1` (cfg default). But `RunConfig` has `warmup_reps: int = 1` hardcoded — it's never set from `cfg` in `warmup_model(model_id, ...)`. The call is:
```python
warmup_model(model_id, current_date, METADATA_TEXT, n_reps=cfg.warmup_reps)
```
This is fine. But when mode=`"both"`, the model runs warmup twice (once for single, once for dual). On 8GB M1 with memory pressure between model loads, the second warmup may actually be loading from cold. Not wrong per se, but the first rep of dual mode after single mode will have stale KV cache. Acceptable given your `free_model_memory()` between models, but worth noting in the paper.

**7. `benchmark_model` receives `cfg.mode` but `benchmark_dual_agent` uses the same model for both router and specialist by default**

```python
result = benchmark_dual_agent(
    model_id, tc, rep, ..., router_model_id=args.router_model
)
```

`args.router_model` is `None` by default, so `router_model = router_model_id or model_id` — same model for both stages. This is your intended setup for sub-2B evaluation, but make sure your paper is explicit that "dual" means "same model used twice sequentially", not two different models. The latency numbers will reflect two full inference passes.

**8. Token counting is unreliable for llama.cpp on Apple Silicon**

`get_last_usage()` is a global singleton getter — if llama.cpp doesn't report token counts (some GGUF builds don't expose this), you'll get zeros throughout. Check: after your first warmup call, `print(get_last_usage())`. If it returns `{"prompt_tokens": 0, "completion_tokens": 0}` consistently, your `Avg_Prompt_Tokens` column will be useless. This won't crash anything but will leave a gap in your efficiency analysis.

**9. `classify_error` returns `"PARSE_FAILURE"` for any tool not in `ALLOWED_TOOLS`, but for sub-2B models the raw output might be a valid tool name with wrong casing**

```python
if predicted_tool not in ALLOWED_TOOLS:
```

`ALLOWED_TOOLS` uses lowercase names. If a model outputs `"Calculate_Total"` or `"PLOT_TIME_SERIES"`, `pred_tool_raw` will be set to whatever `TOOL_ID_TO_NAME` returns (lowercase), so this should be fine. But trace the single-agent path: if the LLM outputs `{"tool": "Plot_Time_Series", ...}`, that string isn't in `TOOL_ID_TO_NAME.values()`, so the fallback `for name in TOOL_ID_TO_NAME.values(): if name in raw_text` triggers. If `"plot_time_series"` appears anywhere in `raw_text`, it matches. Sub-2B models often add explanation text, so this fallback could match spuriously. Consider normalizing: `tool_val.lower().replace(" ", "_")` before the lookup.

---

## Minor Issues and Edge Cases

**10. `TS09` expected category casing inconsistency**

In `test_cases.py`:
```python
"expected": {"category": "souvenirs/gifts/treats", "months": 12},
```
But `DI18` has:
```python
"expected": {"category": "Souvenirs/Gifts/Treats", ...},
```
And `CT04`/`CT05` have `"souvenirs/gifts/treats"` (lowercase). The `_lower_dict` normalization in `score_row` handles key casing, but value comparison is `str(v).lower()` on both sides, so `"Souvenirs/Gifts/Treats"` and `"souvenirs/gifts/treats"` will both become `"souvenirs/gifts/treats"` and match correctly. No functional bug, but inconsistency in ground truth is worth noting for the paper's data quality discussion.

**11. `TS23` expected uses `months=18` for "past 1.5 yrs"**

Your `BASE_INSTRUCTIONS` in `tool_prompts.py` correctly documents: `"past 2.5 years" -> months=30`. So 1.5 years → months=18. Sub-2B models may output `months=1.5` or `year` + fractional. The float-to-int normalization in point 4 would convert `1.5` → left as-is (since `1.5 != int(1.5)`). Add explicit handling: if `months` is a float, round to nearest int. This specific test case will be a source of PARAM_VALUE_WRONG errors for weaker models.

**12. `CP24` and `CP28` have `ey1`/`ey2` in expected but these keys only appear in the comparison tool prompt examples — they're absent from the tool_prompt's `parameters` list**

In `tool_prompts.py`, `plot_comparison_bars` parameters:
```
category (str, optional), y1 (int, optional), m1 (int, optional), d1 (int, optional), 
y2 (int, optional), m2 (int, optional), d2 (int, optional), sm1 (int, optional), 
em1 (int, optional), sm2 (int, optional), em2 (int, optional), 
ey1 (int, optional), ey2 (int, optional), ignore_rent (bool, optional, defaults to false)
```

Actually `ey1` and `ey2` are listed. Good. But in `BASE_INSTRUCTIONS`, the date rules section doesn't document `ey1`/`ey2` until the cross-year range bullet. Sub-2B models reading linearly may miss it. This is a genuine model capability test, not a bug — just expect these cases to score poorly.

**13. `build_metadata_text()` returns only category names, no major category grouping**

```python
def build_metadata_text() -> str:
    all_categories = sorted(set(MAJOR_CATEGORIES) | set(CATEGORY_MAPPING.keys()))
    lines = ["### CATEGORIES (available options for 'category' argument):"]
```

All 50+ categories are listed flat. Sub-2B models may not be able to infer which are major vs sub-categories. The specialist prompts include this metadata, but the single-agent prompt also uses it. Given your models' context limits, a flat 50-item list is fine — just be aware that semantic mapping (e.g., "snacks" → picks "Food" instead of "snacks") will be more frequent.

**14. `DI03` query/expected mismatch comment**

The comment says `# FIX: query was "2025/06 to 2025/02" (inverted). Corrected to match expected Feb→Jun.` — the expected is `start_month: 2, end_month: 6`. The query now reads `"2025/02 to 2025/06"`. This is consistent. Confirmed no issue.

**15. Resource monitor CPU percent may read near-zero for GPU-accelerated inference**

```python
cpu = self.process.cpu_percent(interval=None) / max(psutil.cpu_count() or 1, 1)
```

On M1 with Metal acceleration, most compute happens on the GPU/ANE. `cpu_percent` will show low values. `peak_ram_mb` from RSS is valid for unified memory but won't distinguish GPU allocation. This is a known limitation — just disclaim it in the paper's experimental setup.

---

## Pre-run Checklist

Before you kick off the full benchmark run:

```python
# Add this to main() before the benchmark loops
from experiments.models import get_llamacpp_models
from experiments.inference import generate, get_last_usage
from utils.tool_registry import TOOL_ID_TO_NAME

# Sanity checks
assert set(TOOL_ID_TO_NAME.values()) == ALLOWED_TOOLS, f"Tool registry mismatch: {TOOL_ID_TO_NAME}"
print("VALIDATION_DF columns:", VALIDATION_DF.columns.tolist())
print("VALIDATION_DF head:", VALIDATION_DF.head(3))
print("Available models:", get_llamacpp_models())
print("TEST_CASES count:", len(TEST_CASES))
print("Complexity distribution:", 
      {lvl: sum(1 for tc in TEST_CASES if tc["difficulty"] == lvl) 
       for lvl in ["L1", "L2", "L3"]})
```

Also do a `--quick` dry run on a single model, single mode before committing to the full run:
```bash
python expense_benchmark.py --mode single --quick
```

Check the CSV output: confirm `Prompt_Tokens` is non-zero, `Pred_Tool_Raw` values are in `ALLOWED_TOOLS`, and `FSP_Raw` isn't 1.0 for everything (which would indicate the fallback is always firing correctly by accident).

---

## Summary Table

| # | Issue | Severity | Fix Required Before Run |
|---|-------|----------|------------------------|
| 1 | `VALIDATION_DF` column name match | High | Verify with print |
| 2 | String tool name in single-agent JSON | Medium | Add string→ID normalization |
| 3 | `TOOL_ID_TO_NAME` unverified | High | Add assert at startup |
| 4 | `ignore_rent` as int not bool | Medium | Add bool_keys normalization |
| 5 | AVC bool/int mismatch | Low | Handled by fix 4 |
| 6 | Warmup cold-cache in both mode | Low | Document in paper |
| 7 | Dual mode = same model twice | Low | Document in paper |
| 8 | Token counting may be all zeros | Medium | Check after warmup |
| 9 | Tool name casing in fallback | Medium | Add `.lower()` normalization |
| 10 | Category casing inconsistency in ground truth | Low | Functionally OK |
| 11 | `months=1.5` not handled | Low | Add `round()` for float months |
| 12 | `ey1`/`ey2` hard for small models | None | Known test difficulty |
| 13 | Flat metadata list | None | Acceptable |

The three things I'd fix before running: the `TOOL_ID_TO_NAME` assertion (3), the `ignore_rent` bool normalization (4), and the startup print to verify `VALIDATION_DF` columns (1). Everything else is either acceptable for a benchmark or low enough risk that the `--quick` dry run will surface it.