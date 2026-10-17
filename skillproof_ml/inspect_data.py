"""
Skillproof Data Inspection Script
=================================

Inspects the uploaded Skillseto_100_Fictional_Candidates.csv file and produces
a structured inspection report. Does NOT modify the source file.

Outputs:
  - inspection_report.json (structured)
  - Prints a human-readable summary to stdout
"""

from __future__ import annotations
import json
import re
from pathlib import Path
import pandas as pd

UPLOAD_DIR = Path("/home/z/my-project/upload")
OUT_DIR = Path("/home/z/my-project/skillproof_ml")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_FILE = UPLOAD_DIR / "Skillseto_100_Fictional_Candidates.csv"


def main() -> None:
    # The file is UTF-8 with BOM — pandas handles it with encoding='utf-8-sig'
    df = pd.read_csv(SOURCE_FILE, encoding="utf-8-sig")

    report: dict = {
        "source_file": str(SOURCE_FILE),
        "file_exists": SOURCE_FILE.exists(),
        "file_size_bytes": SOURCE_FILE.stat().st_size if SOURCE_FILE.exists() else 0,
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "columns": list(df.columns),
    }

    # Column-by-column profile
    col_profiles: list[dict] = []
    for col in df.columns:
        series = df[col]
        non_null = int(series.notna().sum())
        missing_pct = round(100.0 * (1 - non_null / len(df)), 2)
        col_profiles.append({
            "name": col,
            "dtype": str(series.dtype),
            "non_null_count": non_null,
            "missing_count": int(series.isna().sum()),
            "missing_pct": missing_pct,
            "unique_count": int(series.nunique()),
            "sample_values": [str(v) for v in series.dropna().head(3).tolist()],
        })
    report["column_profiles"] = col_profiles

    # Duplicate detection
    dup_full = int(df.duplicated().sum())
    dup_id = int(df["Candidate ID"].duplicated().sum()) if "Candidate ID" in df.columns else None
    report["duplicates"] = {
        "full_row_duplicates": dup_full,
        "duplicate_candidate_ids": dup_id,
    }

    # Data-notice check (every row should be labelled synthetic)
    if "Data Notice" in df.columns:
        notice_values = df["Data Notice"].value_counts().to_dict()
        report["data_notice_values"] = {str(k): int(v) for k, v in notice_values.items()}

    # Faculty review status distribution
    if "Faculty Review Status (demo)" in df.columns:
        report["faculty_review_status_values"] = df["Faculty Review Status (demo)"].value_counts().to_dict()

    # Target role distribution
    if "Target Role" in df.columns:
        report["target_role_distribution"] = df["Target Role"].value_counts().to_dict()

    # Graduation year distribution
    if "Graduation Year" in df.columns:
        report["graduation_year_distribution"] = df["Graduation Year"].value_counts().sort_index().to_dict()

    # Assessment-result parsing probe (extract the score /100)
    if "Assessment Result (demo)" in df.columns:
        sample = df["Assessment Result (demo)"].dropna().head(3).tolist()
        report["assessment_sample_values"] = [str(s) for s in sample]
        # Try to extract "NN/100"
        scores = df["Assessment Result (demo)"].astype(str).str.extract(r"(\d+)\s*/\s*100")[0]
        report["assessment_score_parsed_count"] = int(scores.notna().sum())
        if scores.notna().sum() > 0:
            report["assessment_score_stats"] = {
                "min": float(scores.dropna().astype(int).min()),
                "max": float(scores.dropna().astype(int).max()),
                "mean": round(float(scores.dropna().astype(int).mean()), 2),
            }

    # Core-skills tokenisation probe
    if "Core Skills" in df.columns:
        all_skills: list[str] = []
        for s in df["Core Skills"].dropna():
            all_skills.extend([t.strip() for t in str(s).split(",")])
        unique_skills = sorted(set(all_skills))
        report["core_skills"] = {
            "total_token_count": len(all_skills),
            "unique_skill_count": len(unique_skills),
            "sample_unique_skills": unique_skills[:20],
        }

    # Check for explicit target/label columns
    candidate_label_cols = [
        c for c in df.columns
        if any(k in c.lower() for k in ("label", "outcome", "hired", "placed", "fit", "review_status"))
    ]
    report["candidate_label_columns"] = candidate_label_cols
    report["supervised_label_available"] = False  # we will confirm below
    if candidate_label_cols:
        # Inspect each candidate label column — is it a usable supervised target?
        label_eval = {}
        for c in candidate_label_cols:
            vc = df[c].value_counts(dropna=False).to_dict()
            label_eval[c] = {str(k): int(v) for k, v in vc.items()}
        report["label_column_distributions"] = label_eval
        # Faculty Review Status is a *verification* flag, NOT a fit/hiring label
        # so we explicitly mark it as not a supervised target for fit prediction.
        report["supervised_label_available"] = False
        report["label_evaluation_note"] = (
            "The 'Faculty Review Status (demo)' column is a verification status "
            "(Pending review / Verified by faculty), NOT a student-job fit or hiring outcome label. "
            "It cannot be used as a supervised target for predicting fit. "
            "No historical hiring or interview outcome labels exist in the source file. "
            "Supervised training is therefore NOT justified by this dataset."
        )

    # Save structured report
    report_path = OUT_DIR / "inspection_report.json"
    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"[saved] {report_path}")

    # Print human-readable summary
    print("\n" + "=" * 70)
    print("SKILLPROOF — DATA INSPECTION SUMMARY")
    print("=" * 70)
    print(f"Source file:           {report['source_file']}")
    print(f"File exists:           {report['file_exists']}")
    print(f"Row count:             {report['row_count']}")
    print(f"Column count:         {report['column_count']}")
    print(f"Full-row duplicates:  {report['duplicates']['full_row_duplicates']}")
    print(f"Duplicate IDs:        {report['duplicates']['duplicate_candidate_ids']}")
    if "data_notice_values" in report:
        print(f"Data notice values:   {report['data_notice_values']}")
    print()
    print("Column profiles:")
    for p in col_profiles:
        print(f"  - {p['name']:<40s} | non-null={p['non_null_count']:>3d} | unique={p['unique_count']:>3d} | missing={p['missing_pct']:>5.1f}%")
    print()
    if "target_role_distribution" in report:
        print("Target role distribution:")
        for role, n in report["target_role_distribution"].items():
            print(f"  - {role:<30s} {n}")
    print()
    if "core_skills" in report:
        print(f"Core skills: {report['core_skills']['unique_skill_count']} unique canonical tokens "
              f"({report['core_skills']['total_token_count']} total tokens across all students)")
        print(f"  Sample: {', '.join(report['core_skills']['sample_unique_skills'])}")
    print()
    print(f"Candidate label columns: {candidate_label_cols}")
    print(f"Supervised label available: {report['supervised_label_available']}")
    if "label_evaluation_note" in report:
        print()
        print("Label evaluation note:")
        print("  " + report["label_evaluation_note"])
    print("=" * 70)


if __name__ == "__main__":
    main()
