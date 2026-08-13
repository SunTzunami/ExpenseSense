import pandas as pd
import sys
import os
from pathlib import Path

# Adjust path to import write_excel
script_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.dirname(script_dir)
sys.path.insert(0, backend_root)
sys.path.insert(0, script_dir)

from expense_benchmark import write_excel

outputs_dir = os.path.join(backend_root, "benchmark_outputs")

for mode in ["single", "dual", "combined"]:
    orig_csv_path = os.path.join(outputs_dir, f"run_5reps_{mode}.csv")
    orig_xlsx_path = os.path.join(outputs_dir, f"run_5reps_{mode}.xlsx")
    temp_csv_path = os.path.join(outputs_dir, f"temp_lfm_{mode}.csv")
    
    if not os.path.exists(orig_csv_path):
        print(f"Skipping {mode} as original CSV doesn't exist.")
        continue
    if not os.path.exists(temp_csv_path):
        print(f"Skipping {mode} as temp CSV doesn't exist.")
        continue
        
    print(f"Replacing LFM results in {mode} files...")
    df_orig = pd.read_csv(orig_csv_path)
    df_temp = pd.read_csv(temp_csv_path)
    
    # Filter out old LFM2
    df_orig_filtered = df_orig[df_orig["Model"] != "LFM2-1.2B-Q8_0"]
    
    # Combine with new LFM2.5
    df_combined = pd.concat([df_orig_filtered, df_temp], ignore_index=True)
    
    # Save CSV
    df_combined.to_csv(orig_csv_path, index=False)
    
    # Save Excel using formatting from write_excel
    write_excel(df_combined, Path(orig_xlsx_path))
    print(f"Successfully updated {orig_csv_path} and {orig_xlsx_path}")
