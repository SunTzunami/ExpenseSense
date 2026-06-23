"""
Quick diagnostic script to understand why some models have single-digit accuracy.
Focuses on EXAONE, LFM2, and Gemma-3 in single-agent mode.
"""
import pandas as pd
import numpy as np

df = pd.read_csv("run_5reps_combined.csv")

print("=" * 90)
print("MODELS & MODES IN DATASET")
print("=" * 90)
models = df["Model"].unique()
modes = df["Benchmark_Mode"].unique()
print(f"Models: {list(models)}")
print(f"Modes:  {list(modes)}")

# --- Per-model, per-mode overall accuracy ---
print("\n" + "=" * 90)
print("OVERALL TASK ACCURACY (%) BY MODEL × MODE  (Validated)")
print("=" * 90)
summary = df.groupby(["Model", "Benchmark_Mode"])["Task_Acc_Validated"].mean() * 100
summary_unstacked = summary.unstack("Benchmark_Mode")
print(summary_unstacked.round(1).to_string())

# --- Focus on the BAD performers ---
bad_combos = [
    ("EXAONE-4.0-1.2B-Q8_0", "single"),
    ("LFM2-1.2B-Q8_0", "single"),
    ("LFM2-1.2B-Q8_0", "dual"),
    ("Gemma-3-1B-Q8_0", "single"),
    ("EXAONE-4.0-1.2B-Q8_0", "dual"),
]

for model_name, mode in bad_combos:
    subset = df[(df["Model"] == model_name) & (df["Benchmark_Mode"] == mode)]
    if subset.empty:
        # Try partial match
        subset = df[(df["Model"].str.contains(model_name.split("-")[0], case=False)) & (df["Benchmark_Mode"] == mode)]
    if subset.empty:
        print(f"\n⚠  No data for {model_name} / {mode}")
        continue
    
    actual_model = subset["Model"].iloc[0]
    acc = subset["Task_Acc_Validated"].mean() * 100
    
    print(f"\n{'=' * 90}")
    print(f"DIAGNOSING: {actual_model} | {mode} | Task Acc = {acc:.1f}%")
    print(f"{'=' * 90}")
    
    # 1. Error type distribution
    print(f"\n  Error Type Distribution (Validated):")
    err_counts = subset["Error_Type_Validated"].value_counts()
    for err, count in err_counts.items():
        pct = count / len(subset) * 100
        print(f"    {err:<30s}  {count:4d}  ({pct:.1f}%)")
    
    # 2. Completion tokens distribution
    print(f"\n  Completion Tokens stats:")
    ct = subset["Completion_Tokens"]
    print(f"    mean={ct.mean():.1f}  median={ct.median():.0f}  min={ct.min()}  max={ct.max()}")
    print(f"    Token=1 count: {(ct == 1).sum()} / {len(ct)} = {(ct == 1).mean()*100:.1f}%")
    print(f"    Token≤5 count: {(ct <= 5).sum()} / {len(ct)} = {(ct <= 5).mean()*100:.1f}%")
    
    # 3. Specialist_Time_s distribution (look for near-zero = KV cache hit)
    print(f"\n  Specialist Time (s) stats:")
    st = subset["Specialist_Time_s"]
    print(f"    mean={st.mean():.3f}  median={st.median():.3f}  min={st.min():.4f}  max={st.max():.3f}")
    near_zero = (st < 0.15).sum()
    print(f"    Near-zero (<0.15s): {near_zero} / {len(st)} = {near_zero/len(st)*100:.1f}%")
    
    # 4. Sample raw outputs for wrong answers
    wrong = subset[subset["Task_Acc_Validated"] == 0.0]
    if not wrong.empty:
        print(f"\n  Sample RAW outputs from WRONG answers (first 8 unique):")
        # Show unique specialist raw outputs
        unique_raw = wrong["Specialist_Raw"].dropna().unique()[:8]
        for i, raw in enumerate(unique_raw):
            raw_str = str(raw)[:200]
            print(f"    [{i+1}] {raw_str}")
        
        # Also show what tool was predicted
        print(f"\n  Predicted tools (wrong answers):")
        pred_tools = wrong["Pred_Tool_Validated"].value_counts()
        for tool, count in pred_tools.items():
            print(f"    {tool:<30s}  {count:4d}")
    
    # 5. Per-TC_Group accuracy
    print(f"\n  Per TC_Group accuracy:")
    group_acc = subset.groupby("TC_Group")["Task_Acc_Validated"].mean() * 100
    for group, a in group_acc.items():
        print(f"    {group:<25s}  {a:.1f}%")

# --- Cross-comparison: same model, dual vs single ---
print("\n" + "=" * 90)
print("DUAL vs SINGLE ACCURACY COMPARISON (for context)")
print("=" * 90)
for model in sorted(df["Model"].unique()):
    dual = df[(df["Model"] == model) & (df["Benchmark_Mode"] == "dual")]["Task_Acc_Validated"].mean() * 100
    single = df[(df["Model"] == model) & (df["Benchmark_Mode"] == "single")]["Task_Acc_Validated"].mean() * 100
    delta = single - dual
    flag = " <<<< MASSIVE DROP" if delta < -20 else ""
    print(f"  {model:<30s}  dual={dual:5.1f}%  single={single:5.1f}%  Δ={delta:+.1f}%{flag}")

# --- Specific look at rep-level stability ---
print("\n" + "=" * 90)
print("REP-LEVEL STABILITY: % of TCs where ALL 5 reps give SAME answer")
print("=" * 90)
for model in sorted(df["Model"].unique()):
    for mode in ["single", "dual"]:
        sub = df[(df["Model"] == model) & (df["Benchmark_Mode"] == mode)]
        if sub.empty:
            continue
        # Group by TC_ID, check if all reps have same Task_Acc
        tc_groups = sub.groupby("TC_ID")["Task_Acc_Validated"]
        all_same = tc_groups.apply(lambda x: x.nunique() == 1).mean() * 100
        all_zero = tc_groups.apply(lambda x: (x == 0).all()).mean() * 100
        all_one = tc_groups.apply(lambda x: (x == 1).all()).mean() * 100
        print(f"  {model:<30s} {mode:<8s}  same_answer={all_same:.0f}%  all_correct={all_one:.0f}%  all_wrong={all_zero:.0f}%")
