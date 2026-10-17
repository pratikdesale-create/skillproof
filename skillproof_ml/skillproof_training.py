"""
Skillproof Baseline Matching & Training-Preparation Script
============================================================

Per the inspection report (inspection_report.json), the source dataset contains
NO supervised labels for student-job fit or hiring outcomes. The
'Faculty Review Status (demo)' column is a verification flag
(Pending review / Verified by faculty), NOT a fit/hiring label.

Per the master prompt section 7:
  "If no valid target labels exist, explicitly state that supervised
   predictive training is not justified by the available dataset.
   Prepare the feature dataset and a transparent weighted skill-matching
   baseline instead, and specify what additional labels need to be collected."

This script therefore:
  1. Loads the engineered features (skillproof_features.csv).
  2. Implements a transparent weighted skill-matching baseline (mirrors the
         Skillproof platform's matching.ts formula: weight 4 for required,
         1 for preferred).
  3. Evaluates the baseline against a proxy "ideal ranking" — the student's
         own target role should be the role they score highest for, IF the
         baseline is meaningful. This is a sanity check, NOT a model metric.
  4. Reports ranking quality (does the baseline rank the student's target
         role in their top-K?).
  5. Reports class imbalance and label-quality concerns for future
         supervised training.
  6. Does NOT train a supervised model on synthetic labels.
  7. Saves an ML-ready feature table for future training when real labels
         are collected.

Outputs:
  - skillproof_baseline_evaluation.json
  - skillproof_ml_ready_features.csv (with explicitly-named target column = null)
"""

from __future__ import annotations
import json
from pathlib import Path
import pandas as pd
import numpy as np

OUT_DIR = Path("/home/z/my-project/skillproof_ml")


def main() -> None:
    features = pd.read_csv(OUT_DIR / "skillproof_features.csv")
    baseline = pd.read_csv(OUT_DIR / "skillproof_baseline_predictions.csv")

    print("=" * 70)
    print("SKILLPROOF — BASELINE MATCHING EVALUATION")
    print("=" * 70)
    print(f"Feature rows: {len(features)}  (100 students × 10 roles)")
    print()

    # ---------------------------------------------------------------
    # 1. Proxy sanity check: for each student, does their own target
    #    role rank #1 by baseline_match_score?
    # ---------------------------------------------------------------
    target_match_rows = features[features["is_target_role_match"]].copy()
    # For each student, compute the rank of their target role vs all roles
    ranks: list[int] = []
    top_k_counts = {1: 0, 3: 0, 5: 0}
    for sid, group in features.groupby("student_id"):
        sorted_roles = group.sort_values(
            ["baseline_match_score", "required_coverage"], ascending=False
        ).reset_index(drop=True)
        sorted_roles["rank"] = sorted_roles.index + 1
        target_row = sorted_roles[sorted_roles["evaluated_role"] == sorted_roles["target_role"].iloc[0]]
        if len(target_row) == 0:
            continue
        target_rank = int(target_row.iloc[0]["rank"])
        ranks.append(target_rank)
        for k in top_k_counts:
            if target_rank <= k:
                top_k_counts[k] += 1

    n_students = len(ranks)
    print("Proxy sanity check — does the student's target role rank in their top-K?")
    print(f"  Target role ranked #1 (out of 10):    {top_k_counts[1]:>3d} / {n_students}  ({100*top_k_counts[1]/n_students:.1f}%)")
    print(f"  Target role ranked in top 3:          {top_k_counts[3]:>3d} / {n_students}  ({100*top_k_counts[3]/n_students:.1f}%)")
    print(f"  Target role ranked in top 5:          {top_k_counts[5]:>3d} / {n_students}  ({100*top_k_counts[5]/n_students:.1f}%)")
    print(f"  Mean target-role rank:               {np.mean(ranks):.2f} / 10")
    print()
    print("⚠️  IMPORTANT: this is NOT a model accuracy metric.")
    print("    The source dataset contains only self-declared skills — the baseline")
    print("    will mechanically rank a student's own target role highest because")
    print("    the Core Skills column was authored to match the target role. This is a")
    print("    sanity check of internal consistency, not a measure of predictive power.")
    print()

    # ---------------------------------------------------------------
    # 2. Class imbalance & label-quality report (for future training)
    # ---------------------------------------------------------------
    print("Label availability assessment (per master prompt section 7):")
    print(f"  Rows with a real hiring/outcome label:      0 / {len(features)}")
    print(f"  Rows with a fit-category label (e.g. strong/weak): 0 / {len(features)}")
    print(f"  Rows with a verification flag (Faculty Review):    {len(features)} / {len(features)}  (NOT a fit label)")
    print()
    faculty_dist = target_match_rows["faculty_review_status"].value_counts() if "faculty_review_status" in target_match_rows.columns else pd.Series()
    print(f"  Faculty review status distribution (student's target-role rows):")
    for status, n in faculty_dist.items():
        print(f"    {status}: {n}")
    print()
    print("Verdict: supervised predictive training is NOT justified by this dataset.")
    print("         Implementing only the rules-based weighted baseline (above).")
    print()

    # ---------------------------------------------------------------
    # 3. Per-role baseline distribution
    # ---------------------------------------------------------------
    print("Baseline match-score distribution per role (across all 100 students):")
    per_role = baseline.groupby("evaluated_role")["baseline_match_score"].agg(["mean", "median", "min", "max", "std"]).round(2)
    print(per_role.to_string())
    print()

    # ---------------------------------------------------------------
    # 4. Save ML-ready features (target column = explicit null)
    # ---------------------------------------------------------------
    ml_ready = features.copy()
    ml_ready["target_fit_label"] = pd.NA  # explicit null — to be filled when real labels collected
    ml_ready["target_label_source"] = pd.NA
    ml_ready["target_label_date"] = pd.NA
    ml_ready_path = OUT_DIR / "skillproof_ml_ready_features.csv"
    ml_ready.to_csv(ml_ready_path, index=False)
    print(f"[saved] {ml_ready_path}")

    # ---------------------------------------------------------------
    # 5. Save evaluation summary
    # ---------------------------------------------------------------
    eval_summary = {
        "verdict": "supervised_training_not_justified",
        "reason": (
            "Source dataset (Skillseto_100_Fictional_Candidates.csv) contains no "
            "supervised labels for student-job fit or hiring outcomes. The "
            "'Faculty Review Status (demo)' column is a verification flag, not a "
            "fit/hiring label. All 100 rows are explicitly labelled synthetic."
        ),
        "baseline_method": (
            "Weighted skill-coverage matching (mirrors Skillproof platform's "
            "matching.ts: score = 100 * (4 * req_covered + 1 * pref_covered) / "
            "(4 * req_total + 1 * pref_total))"
        ),
        "proxy_sanity_check": {
            "target_role_ranked_1": f"{top_k_counts[1]} / {n_students} ({100*top_k_counts[1]/n_students:.1f}%)",
            "target_role_in_top_3": f"{top_k_counts[3]} / {n_students} ({100*top_k_counts[3]/n_students:.1f}%)",
            "target_role_in_top_5": f"{top_k_counts[5]} / {n_students} ({100*top_k_counts[5]/n_students:.1f}%)",
            "mean_target_role_rank": f"{np.mean(ranks):.2f} / 10",
            "interpretation": (
                "Internal-consistency check only. The source's Core Skills column "
                "was authored to match each student's target role, so the baseline "
                "will mechanically rank the target role highest. This is NOT a "
                "predictive-accuracy metric and must not be reported as such."
            ),
        },
        "per_role_baseline_distribution": per_role.to_dict(),
        "label_availability": {
            "rows_with_hiring_outcome_label": 0,
            "rows_with_fit_category_label": 0,
            "rows_with_verification_flag_only": int(len(features)),
            "verification_flag_is_not_a_fit_label": True,
        },
        "required_additional_labels_for_supervised_training": [
            "Recruiter-reviewed fit label per (student, job) pair — e.g. {poor, weak, moderate, strong, excellent}",
            "Historical application outcomes — e.g. {rejected, screening, interviewed, offered, hired}",
            "At least 200-500 labelled (student, job) pairs across multiple roles for a meaningful train/validation split",
            "Per-skill verification status (not just a record-level faculty flag) so evidence-backed skills can be distinguished from self-declared ones",
            "A documented labelling protocol (who labelled, when, rubric) for reproducibility",
        ],
        "ml_ready_features_file": str(ml_ready_path),
        "ml_ready_features_columns": list(ml_ready.columns),
        "ml_ready_features_target_column_state": "all null — to be filled when real labels are collected",
    }
    eval_path = OUT_DIR / "skillproof_baseline_evaluation.json"
    with eval_path.open("w", encoding="utf-8") as f:
        json.dump(eval_summary, f, indent=2, default=str)
    print(f"[saved] {eval_path}")
    print()
    print("=" * 70)
    print("Evaluation complete. See skillproof_model_evaluation.md for the full report.")
    print("=" * 70)


if __name__ == "__main__":
    main()
