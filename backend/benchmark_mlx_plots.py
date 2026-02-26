"""
plot_results.py

Reads 'my_results.xlsx' (specifically the 'Raw Observations' sheet)
and generates the publication-quality plots found in benchmark_mlx.py.

Usage:
    python plot_results.py --input my_results.xlsx --output figures/
"""

import argparse
import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator
from matplotlib.gridspec import GridSpec

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG & STYLING (Copied from benchmark_mlx.py)
# ──────────────────────────────────────────────────────────────────────────────

_PALETTE = [
    "#0072B2", "#E69F00", "#009E73", "#CC79A7",
    "#56B4E9", "#D55E00", "#F0E442", "#000000",
]

_STAGE_COLORS = {
    "Router":     "#0072B2",
    "Specialist": "#E69F00",
    "Summarizer": "#009E73",
}

_METRIC_STYLES = [
    ("Router",  "avg_router_acc", "///",   "#0072B2"),
    ("Fn Call", "avg_fn_acc",     "\\\\\\","#E69F00"),
    ("Params",  "avg_param_acc",  "...",   "#009E73"),
]

def _pub_style() -> None:
    plt.rcParams.update({
        "font.family":       "sans-serif",
        "font.sans-serif":   ["Arial", "Helvetica", "DejaVu Sans"],
        "font.size":         9,
        "axes.titlesize":    10,
        "axes.labelsize":    9,
        "xtick.labelsize":   8,
        "ytick.labelsize":   8,
        "legend.fontsize":   8,
        "axes.spines.top":   False,
        "axes.spines.right": False,
        "axes.linewidth":    0.8,
        "axes.grid":         True,
        "grid.linestyle":    "--",
        "grid.linewidth":    0.4,
        "grid.alpha":        0.5,
        "grid.color":        "#cccccc",
        "xtick.direction":   "out",
        "ytick.direction":   "out",
        "figure.dpi":        150,
        "savefig.dpi":       300,
        "savefig.bbox":      "tight",
        "savefig.pad_inches": 0.05,
        "lines.linewidth":   1.5,
        "lines.markersize":  6,
        "legend.frameon":    True,
        "legend.framealpha": 0.9,
        "legend.edgecolor":  "#cccccc",
        "legend.handlelength": 1.5,
    })

def _short(model_id: str) -> str:
    """Return a compact label from a full model path."""
    name = str(model_id).split("/")[-1]
    name = name.replace("-MLX-", "-").replace("-MLX", "")
    for suffix in ("-Instruct", "-instruct"):
        name = name.replace(suffix, "")
    return name

def _savefig(fig, out_dir: str, name: str, fmt: str = "png") -> None:
    path = os.path.join(out_dir, f"{name}.{fmt}")
    fig.savefig(path)
    plt.close(fig)
    print(f"  [saved] {path}")

# ──────────────────────────────────────────────────────────────────────────────
# DATA LOADING
# ──────────────────────────────────────────────────────────────────────────────

def load_and_clean_data(excel_path: str) -> pd.DataFrame:
    print(f"Reading '{excel_path}'...")
    
    # Load the Raw Observations sheet
    try:
        df = pd.read_excel(excel_path, sheet_name="Raw Observations")
    except ValueError:
        # Fallback if sheet name is different or default
        df = pd.read_excel(excel_path, sheet_name=0)

    # Map Excel headers (Human Readable) to Internal Variable Names
    # Based on _write_raw_sheet in benchmark_mlx.py
    column_map = {
        "Model":           "Model",
        "TC ID":           "TC_ID",
        "Category":        "TC_Category",
        "Rep":             "Repetition",
        "Total (s)":       "Total_Time_s",
        "Router (s)":      "Router_Time_s",
        "Spec (s)":        "Specialist_Time_s",
        "Summary (s)":     "Summary_Time_s",
        "Composite":       "Composite_Acc",
        "Router OK":       "Router_Correct",
        "Fn OK":           "Fn_Correct",
        "Param OK":        "Param_Correct"
    }
    
    # Rename columns
    df = df.rename(columns=column_map)
    
    # Convert "OK"/"FAIL" text columns to 1.0/0.0
    bool_cols = ["Router_Correct", "Fn_Correct", "Param_Correct"]
    for col in bool_cols:
        if col in df.columns:
            # Handle string "OK"/"FAIL" and potential existing numbers
            df[col] = df[col].apply(lambda x: 1.0 if str(x).strip().upper() == "OK" else (0.0 if str(x).strip().upper() == "FAIL" else x))
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    # Ensure numeric columns are floats
    num_cols = ["Total_Time_s", "Router_Time_s", "Specialist_Time_s", "Summary_Time_s", "Composite_Acc"]
    for col in num_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

    print(f"Loaded {len(df)} rows.")
    return df

# ──────────────────────────────────────────────────────────────────────────────
# PLOTTING FUNCTIONS
# ──────────────────────────────────────────────────────────────────────────────

def generate_plots(df: pd.DataFrame, out_dir: str):
    _pub_style()
    
    # Prepare Aggregations
    model_col = df["Model"].unique().tolist()
    color_map = {m: _PALETTE[i % len(_PALETTE)] for i, m in enumerate(model_col)}
    marker_map = {m: ["o", "s", "^", "D", "v", "p", "P", "*", "X"][i % 9] for i, m in enumerate(model_col)}
    labels    = [_short(m) for m in model_col]

    # Main Grouping (Means & Stds)
    mg = df.groupby("Model").agg(
        avg_total_s    = ("Total_Time_s",      "mean"),
        std_total_s    = ("Total_Time_s",      "std"),
        avg_router_s   = ("Router_Time_s",     "mean"),
        avg_spec_s     = ("Specialist_Time_s", "mean"),
        avg_sum_s      = ("Summary_Time_s",    "mean"),
        avg_composite  = ("Composite_Acc",     "mean"),
        avg_router_acc = ("Router_Correct",    "mean"),
        avg_fn_acc     = ("Fn_Correct",        "mean"),
        avg_param_acc  = ("Param_Correct",     "mean"),
    ).reindex(model_col)

    # Category Pivot
    cat_pivot = (
        df.groupby(["Model", "TC_Category"])["Composite_Acc"]
        .mean()
        .unstack("TC_Category")
        .reindex(model_col)
        * 100
    )

    # Per-TC Average
    tc_avg = (
        df.groupby(["Model", "TC_ID"])["Composite_Acc"]
        .mean()
        .reset_index()
    )

    # RNG for jitter consistency
    rng = np.random.default_rng(42)

    # 1. Accuracy vs Latency Scatter
    fig, ax = plt.subplots(figsize=(4.5, 3.5))
    for model, row in mg.iterrows():
        col = color_map[model]
        ax.errorbar(
            row["avg_total_s"], row["avg_composite"] * 100,
            xerr=row["std_total_s"],
            fmt=marker_map[model], color=col, markersize=9, alpha=0.8,
            capsize=3, capthick=1.0, elinewidth=1.0,
            label=_short(model), zorder=3,
        )
    ax.axhline(mg["avg_composite"].max() * 100, color="#aaaaaa", ls=":", lw=0.8, zorder=1)
    ax.axvline(mg["avg_total_s"].min(),          color="#aaaaaa", ls=":", lw=0.8, zorder=1)
    ax.set_xlabel("Average Total Latency (s)")
    ax.set_ylabel("Composite Accuracy (%)")
    ax.set_title("Accuracy vs. Latency")
    ax.yaxis.set_major_locator(MultipleLocator(10))
    ax.legend(loc="lower right", fontsize=8, framealpha=0.9)
    ax.set_ylim(0, 105)
    ax.set_xlim(left=0)
    fig.tight_layout()
    _savefig(fig, out_dir, "acc_vs_latency")

    # 2. Latency Breakdown
    fig, ax = plt.subplots(figsize=(max(3.5, len(labels) * 0.9 + 1.5), 3.5))
    x      = np.arange(len(labels))
    bottom = np.zeros(len(labels))
    for stage_label, col_key, color in [
        ("Router",     "avg_router_s", _STAGE_COLORS["Router"]),
        ("Specialist", "avg_spec_s",   _STAGE_COLORS["Specialist"]),
        ("Summarizer", "avg_sum_s",    _STAGE_COLORS["Summarizer"]),
    ]:
        vals = mg[col_key].values
        ax.bar(x, vals, 0.55, bottom=bottom, label=stage_label,
               color=color, edgecolor="white", linewidth=0.5, zorder=3)
        bottom += vals
    ax.errorbar(x, mg["avg_total_s"].values, yerr=mg["std_total_s"].values,
                fmt="none", color="#333333", capsize=3, capthick=0.8, elinewidth=0.8, zorder=4)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("Latency (s)")
    ax.set_title("Pipeline Latency Breakdown\nper Stage")
    ax.legend(loc="upper right")
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    _savefig(fig, out_dir, "latency_breakdown")

    # 3. Accuracy Breakdown
    fig, ax = plt.subplots(figsize=(max(3.5, len(labels) * 1.2 + 1.5), 3.5))
    x      = np.arange(len(labels))
    w      = 0.22
    offs   = np.array([-w, 0, w])
    for (lbl, key, hatch, color), offset in zip(_METRIC_STYLES, offs):
        vals = mg[key].values * 100
        bars = ax.bar(x + offset, vals, w, label=lbl, color=color, alpha=0.85,
                      hatch=hatch, edgecolor="white", linewidth=0.4, zorder=3)
        for bar, v in zip(bars, vals):
            if v > 5:
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                        f"{v:.0f}", ha="center", va="bottom", fontsize=6.5)
    ax.set_xticks(x)
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("Accuracy (%)")
    ax.set_title("Accuracy by Component")
    ax.set_ylim(0, 130)
    ax.legend(loc="upper left", bbox_to_anchor=(0.0, 1.0))
    ax.yaxis.set_major_locator(MultipleLocator(20))
    ax.axhline(100, color="#cccccc", ls="--", lw=0.6, zorder=1)
    fig.tight_layout()
    _savefig(fig, out_dir, "accuracy_breakdown")

    # 4. Category Heatmap
    categories = cat_pivot.columns.tolist()
    fig, ax = plt.subplots(figsize=(max(4, len(categories) * 0.9 + 1.5),
                                    max(2.5, len(labels) * 0.6 + 1.0)))
    im = ax.imshow(cat_pivot.values, aspect="auto", cmap="RdYlGn", vmin=0, vmax=100)
    ax.set_xticks(np.arange(len(categories)))
    ax.set_yticks(np.arange(len(labels)))
    ax.set_xticklabels(categories, rotation=35, ha="right", fontsize=8)
    ax.set_yticklabels(labels, fontsize=8)
    ax.tick_params(length=0)
    ax.spines[:].set_visible(False)
    for i in range(len(labels)):
        for j in range(len(categories)):
            v = cat_pivot.values[i, j]
            if not np.isnan(v):
                tc = "white" if v < 40 or v > 80 else "black"
                ax.text(j, i, f"{v:.0f}", ha="center", va="center",
                        fontsize=7.5, color=tc, fontweight="bold")
    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("Composite Accuracy (%)", fontsize=8)
    cbar.ax.tick_params(labelsize=7)
    ax.set_title("Composite Accuracy by Model × Task Category")
    fig.tight_layout()
    _savefig(fig, out_dir, "category_heatmap")

    # 5. Per TC Strip Plot
    bp_data = [tc_avg[tc_avg["Model"] == m]["Composite_Acc"].values * 100 for m in model_col]
    jitter_w = 0.12
    fig, ax = plt.subplots(figsize=(max(4, len(labels) * 1.1 + 1), 3.5))
    bp = ax.boxplot(bp_data, positions=np.arange(len(model_col)), widths=0.3,
                    patch_artist=True, showfliers=False,
                    medianprops=dict(color="black", linewidth=1.5),
                    whiskerprops=dict(linewidth=0.8),
                    capprops=dict(linewidth=0.8),
                    boxprops=dict(linewidth=0.8))
    for patch, model in zip(bp["boxes"], model_col):
        patch.set_facecolor(color_map[model])
        patch.set_alpha(0.25)
    # Use fresh draw from rng
    for pos, model in zip(np.arange(len(model_col)), model_col):
        vals   = tc_avg[tc_avg["Model"] == model]["Composite_Acc"].values * 100
        jitter = rng.uniform(-jitter_w, jitter_w, len(vals))
        ax.scatter(pos + jitter, vals, s=18, color=color_map[model],
                   alpha=0.75, zorder=4, linewidths=0)
    ax.set_xticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("Composite Accuracy (%) — per TC")
    ax.set_title("Per-Question Accuracy Distribution")
    ax.set_ylim(-5, 108)
    ax.axhline(100, color="#cccccc", ls="--", lw=0.6)
    ax.yaxis.set_major_locator(MultipleLocator(20))
    fig.tight_layout()
    _savefig(fig, out_dir, "per_tc_strip")

    # 6. Latency Box Plot
    lat_data = [df[df["Model"] == m]["Total_Time_s"].values for m in model_col]
    fig, ax  = plt.subplots(figsize=(max(4, len(labels) * 1.1 + 1), 3.5))
    bp2 = ax.boxplot(lat_data, positions=np.arange(len(model_col)), widths=0.4,
                     patch_artist=True, showfliers=True,
                     flierprops=dict(marker=".", markersize=3, alpha=0.4),
                     medianprops=dict(color="black", linewidth=1.5),
                     whiskerprops=dict(linewidth=0.8),
                     capprops=dict(linewidth=0.8),
                     boxprops=dict(linewidth=0.8))
    for patch, model in zip(bp2["boxes"], model_col):
        patch.set_facecolor(color_map[model])
        patch.set_alpha(0.55)
    ax.set_xticks(np.arange(len(labels)))
    ax.set_xticklabels(labels, rotation=20, ha="right")
    ax.set_ylabel("Total Latency (s)")
    ax.set_title("Total Latency Distribution\n(all observations)")
    ax.set_ylim(bottom=0)
    fig.tight_layout()
    _savefig(fig, out_dir, "latency_box")

    # 7. Summary Panel (The Big One)
    fig = plt.figure(figsize=(10, 6.5))
    gs  = GridSpec(2, 3, figure=fig, hspace=0.52, wspace=0.38)

    ax_scatter = fig.add_subplot(gs[0, 0])
    ax_lat_brk = fig.add_subplot(gs[0, 1])
    ax_acc_brk = fig.add_subplot(gs[0, 2])
    ax_heatmap = fig.add_subplot(gs[1, 0:2])
    ax_strip   = fig.add_subplot(gs[1, 2])

    # (a) Scatter
    for model, row in mg.iterrows():
        col = color_map[model]
        ax_scatter.errorbar(
            row["avg_total_s"], row["avg_composite"] * 100,
            xerr=row["std_total_s"],
            fmt=marker_map[model], color=col, markersize=8, alpha=0.8,
            capsize=2.5, capthick=0.8, elinewidth=0.8,
            label=_short(model), zorder=3,
        )
    ax_scatter.set_xlabel("Avg Latency (s)")
    ax_scatter.set_ylabel("Composite Acc. (%)")
    ax_scatter.set_ylim(0, 105)
    ax_scatter.set_xlim(left=0)
    ax_scatter.yaxis.set_major_locator(MultipleLocator(20))
    ax_scatter.legend(loc="lower right", fontsize=6, framealpha=0.9)

    # (b) Latency breakdown
    x_b = np.arange(len(labels))
    bot = np.zeros(len(labels))
    for stage_label, col_key, color in [
        ("Router",     "avg_router_s", _STAGE_COLORS["Router"]),
        ("Specialist", "avg_spec_s",   _STAGE_COLORS["Specialist"]),
        ("Summarizer", "avg_sum_s",    _STAGE_COLORS["Summarizer"]),
    ]:
        vals = mg[col_key].values
        ax_lat_brk.bar(x_b, vals, 0.5, bottom=bot, label=stage_label,
                       color=color, edgecolor="white", linewidth=0.4, zorder=3)
        bot += vals
    ax_lat_brk.set_xticks(x_b)
    ax_lat_brk.set_xticklabels(labels, rotation=22, ha="right", fontsize=7)
    ax_lat_brk.set_ylabel("Latency (s)")
    ax_lat_brk.legend(fontsize=6, loc="upper right")
    ax_lat_brk.set_ylim(bottom=0)

    # (c) Accuracy breakdown
    x_c  = np.arange(len(labels))
    w_c  = 0.22
    offs = np.array([-w_c, 0, w_c])
    for (lbl, key, hatch, color), off in zip(_METRIC_STYLES, offs):
        ax_acc_brk.bar(x_c + off, mg[key].values * 100, w_c, label=lbl,
                       color=color, alpha=0.85, hatch=hatch,
                       edgecolor="white", linewidth=0.3, zorder=3)
    ax_acc_brk.set_xticks(x_c)
    ax_acc_brk.set_xticklabels(labels, rotation=22, ha="right", fontsize=7)
    ax_acc_brk.set_ylabel("Accuracy (%)")
    ax_acc_brk.set_ylim(0, 135)
    ax_acc_brk.legend(fontsize=6, loc="upper right", bbox_to_anchor=(1.05, 1.0))
    ax_acc_brk.axhline(100, color="#cccccc", ls="--", lw=0.5)
    ax_acc_brk.yaxis.set_major_locator(MultipleLocator(25))

    # (d) Heatmap
    im2 = ax_heatmap.imshow(cat_pivot.values, aspect="auto",
                             cmap="RdYlGn", vmin=0, vmax=100)
    ax_heatmap.set_xticks(np.arange(len(categories)))
    ax_heatmap.set_yticks(np.arange(len(labels)))
    ax_heatmap.set_xticklabels(categories, rotation=28, ha="right", fontsize=7)
    ax_heatmap.set_yticklabels(labels, fontsize=7)
    ax_heatmap.tick_params(length=0)
    ax_heatmap.spines[:].set_visible(False)
    for i in range(len(labels)):
        for j in range(len(categories)):
            v = cat_pivot.values[i, j]
            if not np.isnan(v):
                tc_c = "white" if v < 40 or v > 80 else "black"
                ax_heatmap.text(j, i, f"{v:.0f}", ha="center", va="center",
                                fontsize=6.5, color=tc_c, fontweight="bold")
    cbar2 = fig.colorbar(im2, ax=ax_heatmap, fraction=0.025, pad=0.02)
    cbar2.set_label("Acc. (%)", fontsize=7)
    cbar2.ax.tick_params(labelsize=6)

    # (e) Strip
    bp3 = ax_strip.boxplot(bp_data, positions=np.arange(len(model_col)), widths=0.3,
                           patch_artist=True, showfliers=False,
                           medianprops=dict(color="black", linewidth=1.2),
                           whiskerprops=dict(linewidth=0.7),
                           capprops=dict(linewidth=0.7),
                           boxprops=dict(linewidth=0.7))
    for patch, model in zip(bp3["boxes"], model_col):
        patch.set_facecolor(color_map[model])
        patch.set_alpha(0.25)
    for pos, model in zip(np.arange(len(model_col)), model_col):
        vals   = tc_avg[tc_avg["Model"] == model]["Composite_Acc"].values * 100
        jitter = rng.uniform(-jitter_w, jitter_w, len(vals))
        ax_strip.scatter(pos + jitter, vals, s=14, color=color_map[model],
                         alpha=0.75, zorder=4, linewidths=0)
    ax_strip.set_xticks(np.arange(len(labels)))
    ax_strip.set_xticklabels(labels, rotation=22, ha="right", fontsize=7)
    ax_strip.set_ylabel("Acc. (%) per TC")
    ax_strip.set_ylim(-5, 108)
    ax_strip.axhline(100, color="#cccccc", ls="--", lw=0.5)
    ax_strip.yaxis.set_major_locator(MultipleLocator(25))

    for ax_p, plabel in zip([ax_scatter, ax_lat_brk, ax_acc_brk, ax_heatmap, ax_strip],
                             ["(a)", "(b)", "(c)", "(d)", "(e)"]):
        ax_p.set_title(plabel, loc="left", fontweight="bold", fontsize=9, pad=2)

    fig.suptitle("MLX Model Benchmark — Pipeline Accuracy & Latency",
                 fontsize=11, fontweight="bold", y=1.01)
    fig.tight_layout()
    _savefig(fig, out_dir, "summary_panel")

# ──────────────────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate plots from benchmark Excel results.")
    parser.add_argument("--input", default="my_results.xlsx", help="Path to input Excel file")
    parser.add_argument("--output", default="figures/", help="Directory to save plots")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found.")
        return

    os.makedirs(args.output, exist_ok=True)

    df = load_and_clean_data(args.input)
    generate_plots(df, args.output)
    print(f"\nDone. Plots saved to: {args.output}")

if __name__ == "__main__":
    main()