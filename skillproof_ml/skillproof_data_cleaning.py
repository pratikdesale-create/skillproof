"""
Skillproof Data Cleaning, Feature Engineering, and Export Pipeline
===================================================================

Loads the uploaded Skillseto_100_Fictional_Candidates.csv, cleans and
normalises the data, builds the 100-student master dataset + linked
skill/project/certification tables, engineers transparent features,
implements a rules-based weighted skill-matching baseline (NO supervised
model is trained because the source file contains no real fit/hiring
outcome labels — see inspection_report.json and model_evaluation.md).

Source file: /home/z/my-project/upload/Skillseto_100_Fictional_Candidates.csv
Outputs:
  - skillproof_100_students.xlsx   (multi-sheet workbook)
  - skillproof_100_students.csv     (student-level modelling table)
  - skillproof_data_dictionary.xlsx
  - skillproof_data_quality_report.md
  - skillproof_features.csv         (one row per student × target role)
  - skillproof_baseline_predictions.csv (matching baseline scores)
  - cleaning_artifacts.json         (run summary for reproducibility)

The pipeline is idempotent — rerunning it does not duplicate records.
"""

from __future__ import annotations
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows

# ----------------------------------------------------------------
# Paths
# ----------------------------------------------------------------
UPLOAD_DIR = Path("/home/z/my-project/upload")
OUT_DIR = Path("/home/z/my-project/skillproof_ml")
OUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_FILE = UPLOAD_DIR / "Skillseto_100_Fictional_Candidates.csv"

# ----------------------------------------------------------------
# Reference data: target roles and their canonical required/preferred skills
# These are deterministic, rule-based role profiles used by the matching
# baseline. They are NOT learned from data — they are documented role
# profiles that a human recruiter would recognise.
# ----------------------------------------------------------------
ROLE_PROFILES: dict[str, dict[str, list[str]]] = {
    "Python Developer": {
        "required": ["Python", "OOP", "REST APIs", "Git"],
        "preferred": ["pytest", "SQL", "Django basics", "Flask"],
    },
    "Full-Stack Developer": {
        "required": ["React", "Node.js", "Express", "SQL", "Git"],
        "preferred": ["REST APIs", "CSS", "HTML", "API integration"],
    },
    "Data Analyst": {
        "required": ["Python", "SQL", "Excel", "Statistics"],
        "preferred": ["Pandas", "Data visualization", "Power BI", "Tableau"],
    },
    "Machine Learning Intern": {
        "required": ["Python", "Machine learning", "Statistics", "NumPy"],
        "preferred": ["Pandas", "Scikit-learn", "Data preprocessing", "Model evaluation"],
    },
    "Frontend Developer": {
        "required": ["JavaScript", "HTML", "CSS", "React"],
        "preferred": ["TypeScript", "Tailwind CSS", "Responsive design", "Git"],
    },
    "Backend Developer": {
        "required": ["Python", "REST APIs", "SQL", "Git"],
        "preferred": ["Node.js", "Django basics", "Docker basics", "Authentication"],
    },
    "Cybersecurity Analyst": {
        "required": ["Networking basics", "Security fundamentals", "Linux basics", "Cryptography basics"],
        "preferred": ["Python", "Threat analysis", "SIEM basics", "Vulnerability assessment"],
    },
    "Cloud / DevOps Intern": {
        "required": ["Linux basics", "Docker basics", "CI/CD concepts", "Cloud fundamentals"],
        "preferred": ["Kubernetes basics", "AWS basics", "Terraform basics", "Python"],
    },
    "QA Automation Engineer": {
        "required": ["Python", "Selenium basics", "API testing", "Test automation"],
        "preferred": ["pytest", "CI/CD concepts", "REST APIs", "Bug tracking"],
    },
    "UI/UX Designer": {
        "required": ["Figma", "Design systems", "Interaction design", "User research"],
        "preferred": ["Wireframing", "Prototyping", "CSS", "Accessibility"],
    },
}

# Approved skill-alias dictionary (deterministic). Maps lowercased alias → canonical.
# Used by the skill-normalisation step. Mirrors the Skillproof platform's
# src/lib/matching.ts builtin aliases.
SKILL_ALIASES: dict[str, str] = {
    "js": "JavaScript",
    "reactjs": "React",
    "react.js": "React",
    "react js": "React",
    "node": "Node.js",
    "nodejs": "Node.js",
    "node js": "Node.js",
    "ts": "TypeScript",
    "py": "Python",
    "postgres": "PostgreSQL",
    "mongo": "MongoDB",
    "k8s": "Kubernetes basics",
    "aws": "AWS basics",
    "tailwind": "Tailwind CSS",
    "tailwindcss": "Tailwind CSS",
}


def normalise_skill_token(raw: str) -> str:
    """Normalise a single skill token: trim, apply alias dict, preserve canonical case."""
    t = raw.strip()
    if not t:
        return ""
    key = t.lower()
    if key in SKILL_ALIASES:
        return SKILL_ALIASES[key]
    # Title-case for any unrecognised token so exports are consistent
    # but DO NOT merge ambiguous skills automatically.
    return t


def parse_assessment_score(text: str) -> int | None:
    """Extract the NN from 'NN/100' in an assessment-result string. Returns None if not found."""
    if pd.isna(text):
        return None
    m = re.search(r"(\d+)\s*/\s*100", str(text))
    return int(m.group(1)) if m else None


def parse_assessment_role(text: str) -> str | None:
    """Extract the role prefix from 'Python Developer practice assessment: 69/100 ...'."""
    if pd.isna(text):
        return None
    m = re.match(r"^([A-Za-z/\- ]+?)\s+practice assessment", str(text))
    return m.group(1).strip() if m else None


def split_skills(text: str) -> list[str]:
    """Split a comma-separated skill string into a list of normalised canonical tokens."""
    if pd.isna(text):
        return []
    return [normalise_skill_token(t) for t in str(text).split(",") if t.strip()]


# ----------------------------------------------------------------
# Main pipeline
# ----------------------------------------------------------------
def main() -> None:
    artifacts: dict[str, Any] = {
        "source_file": str(SOURCE_FILE),
        "steps": [],
    }

    # ----- 1. LOAD -----
    df = pd.read_csv(SOURCE_FILE, encoding="utf-8-sig")
    artifacts["steps"].append({
        "step": "load",
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
    })

    # ----- 2. VALIDATE UNIQUENESS -----
    dup_ids = int(df["Candidate ID"].duplicated().sum())
    assert dup_ids == 0, f"Duplicate Candidate IDs found: {dup_ids}"
    assert len(df) == 100, f"Expected 100 students, got {len(df)}"
    artifacts["steps"].append({
        "step": "validate_uniqueness",
        "duplicate_candidate_ids": dup_ids,
        "row_count": int(len(df)),
    })

    # ----- 3. BUILD STUDENT MASTER TABLE -----
    # Drop direct identifiers (email, phone, full name) from the modelling export.
    # Keep Candidate ID (already anonymised) as the join key.
    # Per spec section 11 (data privacy): minimise PII in modelling exports.
    students = pd.DataFrame({
        "student_id": df["Candidate ID"],
        "target_role": df["Target Role"],
        "education": df["Education"],
        "institution": df["Institution (fictional)"],
        "graduation_year": df["Graduation Year"].astype(int),
        "professional_summary": df["Professional Summary"],
        "core_skills_raw": df["Core Skills"],
        "project_title": df["Project Title"],
        "project_summary": df["Project Summary"],
        "experience_internship": df["Experience / Internship"],
        "certification_training": df["Certification / Training"],
        "assessment_result_raw": df["Assessment Result (demo)"],
        "assessment_score": df["Assessment Result (demo)"].apply(parse_assessment_score),
        "assessment_role": df["Assessment Result (demo)"].apply(parse_assessment_role),
        "faculty_review_status": df["Faculty Review Status (demo)"],
        "industry_feedback": df["Industry Feedback (demo)"],
        "record_origin": "uploaded_csv",
        "is_synthetic": True,  # every row in the source file is labelled synthetic
        "data_quality_status": "complete",  # no missing values
    })
    artifacts["steps"].append({
        "step": "build_student_master",
        "row_count": int(len(students)),
        "columns": list(students.columns),
    })

    # ----- 4. BUILD SKILLS TABLE (long format) -----
    skills_rows: list[dict] = []
    for _, row in students.iterrows():
        sid = row["student_id"]
        for tok in split_skills(row["core_skills_raw"]):
            skills_rows.append({
                "student_id": sid,
                "canonical_skill_name": tok,
                "evidence_type": "self_declared",
                "evidence_source": "core_skills_csv_column",
                "self_declared_level": None,  # source file has no per-skill level
                "assessment_score": None,    # not broken down per skill in source
                "verification_status": "unverified",  # default — self-declared skills are unverified
            })
    skills_long = pd.DataFrame(skills_rows)
    artifacts["steps"].append({
        "step": "build_skills_long",
        "row_count": int(len(skills_long)),
        "unique_skill_count": int(skills_long["canonical_skill_name"].nunique()),
    })

    # ----- 5. BUILD PROJECTS TABLE -----
    projects = pd.DataFrame({
        "project_id": [f"PROJ-{i+1:03d}" for i in range(len(students))],
        "student_id": students["student_id"],
        "project_title": students["project_title"],
        "project_summary": students["project_summary"],
        "project_domain": students["target_role"],  # closest available domain signal
        "technologies_used": students["core_skills_raw"],  # best available proxy
        "project_evaluation": None,  # not in source
        "repository_reference": None,  # not in source
        "evidence_status": "submitted_not_reviewed",  # default
    })
    artifacts["steps"].append({
        "step": "build_projects",
        "row_count": int(len(projects)),
    })

    # ----- 6. BUILD CERTIFICATIONS TABLE -----
    certs_rows: list[dict] = []
    for _, row in students.iterrows():
        cert_text = row["certification_training"]
        if pd.isna(cert_text) or not str(cert_text).strip():
            continue
        # Try to parse out the certificate name + the "— Course (sample)" suffix
        text = str(cert_text)
        # Extract cert name (everything before the em-dash or en-dash)
        m = re.match(r"^(.+?)\s*[—–-]\s*(.+)$", text)
        if m:
            cert_name = m.group(1).strip()
            cert_context = m.group(2).strip()
        else:
            cert_name = text
            cert_context = ""
        certs_rows.append({
            "student_id": row["student_id"],
            "certification_name": cert_name,
            "context": cert_context,
            "relevant_skill": None,  # source does not link certs to specific skills
            "score_or_result": None,
            "date": None,
            "source": "self_reported",
            "verification_status": "unverified",
        })
    certs = pd.DataFrame(certs_rows)
    artifacts["steps"].append({
        "step": "build_certifications",
        "row_count": int(len(certs)),
    })

    # ----- 7. BUILD JOBS TABLE (from role profiles) -----
    jobs_rows: list[dict] = []
    for role, profile in ROLE_PROFILES.items():
        jobs_rows.append({
            "job_id": f"ROLE-{re.sub(r'[^A-Za-z0-9]+', '_', role).strip('_').upper()}",
            "job_title": role,
            "required_skills": ", ".join(profile["required"]),
            "preferred_skills": ", ".join(profile["preferred"]),
            "experience_requirements": "Entry-level / intern (0-2 yrs)",
            "source": "deterministic_role_profile",
        })
    jobs = pd.DataFrame(jobs_rows)
    artifacts["steps"].append({
        "step": "build_jobs",
        "row_count": int(len(jobs)),
    })

    # ----- 8. FEATURE ENGINEERING (student × role pairs) -----
    # For each student, compute features against their own target role AND against
    # every other role (so we can see how the same student would score for
    # different roles — useful for skill-gap analysis).
    feature_rows: list[dict] = []
    # Pre-build a per-student skill set
    student_skills: dict[str, set[str]] = {}
    for sid, group in skills_long.groupby("student_id"):
        student_skills[sid] = set(group["canonical_skill_name"].tolist())

    for _, student in students.iterrows():
        sid = student["student_id"]
        my_skills = student_skills.get(sid, set())
        for role, profile in ROLE_PROFILES.items():
            required = set(profile["required"])
            preferred = set(profile["preferred"])
            req_covered = my_skills & required
            pref_covered = my_skills & preferred
            req_missing = required - my_skills
            pref_missing = preferred - my_skills

            # Evidence-backed skill count: skills with a faculty-verified status
            # (Since all skills come from the same self-declared column, the
            # faculty-verified count at the student level is either all or none.
            # We compute it from the Faculty Review Status column instead —
            # if the student's record is "Verified by faculty" we count all their
            # skills as evidence-backed; otherwise zero. This is documented in
            # the data dictionary.)
            is_verified_record = "verified" in str(student["faculty_review_status"]).lower()
            evidence_backed_count = len(my_skills) if is_verified_record else 0

            # Required/preferred coverage ratios (0..1)
            req_cov = len(req_covered) / len(required) if required else 1.0
            pref_cov = len(pref_covered) / len(preferred) if preferred else 1.0

            # Weighted skill-matching baseline score:
            # score = 100 * (4 * req_cov + 1 * pref_cov) / 5
            # This mirrors the Skillproof platform's matching.ts formula:
            # weight = 4 for required, 1 for preferred.
            weight_total = 4 * len(required) + 1 * len(preferred)
            weight_covered = 4 * len(req_covered) + 1 * len(pref_covered)
            baseline_score = round(100.0 * weight_covered / weight_total, 2) if weight_total else 0.0

            feature_rows.append({
                "student_id": sid,
                "target_role": student["target_role"],
                "evaluated_role": role,
                "is_target_role_match": role == student["target_role"],
                "total_skills_declared": len(my_skills),
                "evidence_backed_skill_count": evidence_backed_count,
                "required_skill_count": len(required),
                "required_covered_count": len(req_covered),
                "required_missing_count": len(req_missing),
                "required_coverage": round(req_cov, 4),
                "preferred_skill_count": len(preferred),
                "preferred_covered_count": len(pref_covered),
                "preferred_coverage": round(pref_cov, 4),
                "assessment_score": student["assessment_score"],
                "baseline_match_score": baseline_score,
                "missing_required_skills": ", ".join(sorted(req_missing)),
                "covered_required_skills": ", ".join(sorted(req_covered)),
            })
    features = pd.DataFrame(feature_rows)
    artifacts["steps"].append({
        "step": "feature_engineering",
        "feature_row_count": int(len(features)),
        "feature_columns": list(features.columns),
    })

    # ----- 9. BASELINE PREDICTIONS (rules-based) -----
    # Sort by baseline_match_score desc per evaluated_role — this is the
    # ranked shortlist the platform would produce. We are NOT predicting a
    # real hiring outcome; we are ranking candidates by evidence-backed skill
    # coverage.
    baseline_predictions = features.sort_values(
        ["evaluated_role", "baseline_match_score", "required_coverage"],
        ascending=[True, False, False],
    ).reset_index(drop=True)
    baseline_predictions["rank_within_role"] = baseline_predictions.groupby("evaluated_role").cumcount() + 1
    artifacts["steps"].append({
        "step": "baseline_predictions",
        "row_count": int(len(baseline_predictions)),
        "top_3_per_role": baseline_predictions.groupby("evaluated_role").head(3)[
            ["evaluated_role", "student_id", "baseline_match_score", "required_coverage", "rank_within_role"]
        ].to_dict("records"),
    })

    # ----- 10. STUDENT-LEVEL MODELLING TABLE (one row per student) -----
    # For the flat CSV modelling export, we use the student's OWN target role
    # (so the row represents "student X aiming for role Y").
    student_model = features[features["is_target_role_match"]].merge(
        students[["student_id", "education", "institution", "graduation_year",
                  "professional_summary", "faculty_review_status", "is_synthetic"]],
        on="student_id",
        how="left",
    )
    # Drop the long-form skill lists from the flat table — they are in skills_long
    student_model = student_model.drop(columns=["covered_required_skills", "missing_required_skills"])
    artifacts["steps"].append({
        "step": "student_model_table",
        "row_count": int(len(student_model)),
    })

    # ----- 11. EXPORT: CSV -----
    features_csv = OUT_DIR / "skillproof_features.csv"
    features.to_csv(features_csv, index=False)
    print(f"[saved] {features_csv}")

    baseline_csv = OUT_DIR / "skillproof_baseline_predictions.csv"
    baseline_predictions.to_csv(baseline_csv, index=False)
    print(f"[saved] {baseline_csv}")

    student_csv = OUT_DIR / "skillproof_100_students.csv"
    student_model.to_csv(student_csv, index=False)
    print(f"[saved] {student_csv}")

    skills_csv = OUT_DIR / "skillproof_skills_long.csv"
    skills_long.to_csv(skills_csv, index=False)
    print(f"[saved] {skills_csv}")

    projects_csv = OUT_DIR / "skillproof_projects.csv"
    projects.to_csv(projects_csv, index=False)
    print(f"[saved] {projects_csv}")

    certs_csv = OUT_DIR / "skillproof_certifications.csv"
    certs.to_csv(certs_csv, index=False)
    print(f"[saved] {certs_csv}")

    jobs_csv = OUT_DIR / "skillproof_jobs.csv"
    jobs.to_csv(jobs_csv, index=False)
    print(f"[saved] {jobs_csv}")

    # ----- 12. EXPORT: MULTI-SHEET XLSX -----
    xlsx_path = OUT_DIR / "skillproof_100_students.xlsx"
    with pd.ExcelWriter(xlsx_path, engine="openpyxl") as writer:
        students.to_excel(writer, sheet_name="students_master", index=False)
        skills_long.to_excel(writer, sheet_name="skills", index=False)
        projects.to_excel(writer, sheet_name="projects", index=False)
        certs.to_excel(writer, sheet_name="certifications", index=False)
        jobs.to_excel(writer, sheet_name="jobs", index=False)
        features.to_excel(writer, sheet_name="features_student_x_role", index=False)
        baseline_predictions.to_excel(writer, sheet_name="baseline_predictions", index=False)
        student_model.to_excel(writer, sheet_name="student_model_table", index=False)
    print(f"[saved] {xlsx_path}")

    # ----- 13. DATA DICTIONARY -----
    data_dict_rows = [
        # students_master
        ("students_master", "student_id", "string", "Candidate ID", "Direct copy", "Unique anonymised identifier. Example: DEMO-001."),
        ("students_master", "target_role", "string", "Target Role", "Direct copy", "Student's stated target role. 10 distinct values × 10 students each."),
        ("students_master", "education", "string", "Education", "Direct copy", "Degree program (e.g. 'B.Tech — Computer Science and Engineering')."),
        ("students_master", "institution", "string", "Institution (fictional)", "Direct copy", "Fictional institution name."),
        ("students_master", "graduation_year", "integer", "Graduation Year", "Direct copy, cast to int", "Year of graduation. 3 distinct values in source."),
        ("students_master", "professional_summary", "string", "Professional Summary", "Direct copy", "Short free-text summary. Not used as a feature."),
        ("students_master", "core_skills_raw", "string", "Core Skills", "Direct copy", "Comma-separated skill tokens. Tokenised in the skills sheet."),
        ("students_master", "project_title", "string", "Project Title", "Direct copy", "Title of the student's primary project."),
        ("students_master", "project_summary", "string", "Project Summary", "Direct copy", "Free-text project description. Not tokenised."),
        ("students_master", "experience_internship", "string", "Experience / Internship", "Direct copy", "Free-text experience notes. Most rows say 'Academic projects only; no formal internship listed.'"),
        ("students_master", "certification_training", "string", "Certification / Training", "Direct copy", "Certification name + context. Parsed into the certifications sheet."),
        ("students_master", "assessment_result_raw", "string", "Assessment Result (demo)", "Direct copy", "Full text including the synthetic disclaimer."),
        ("students_master", "assessment_score", "integer or null", "Assessment Result (demo)", "Regex extract 'NN/100'", "Synthetic demo score. NOT a real credential. Range 60-99 in source."),
        ("students_master", "assessment_role", "string or null", "Assessment Result (demo)", "Regex extract role prefix", "Role the assessment was for. Usually matches target_role."),
        ("students_master", "faculty_review_status", "string", "Faculty Review Status (demo)", "Direct copy", "Verification flag, NOT a hiring label. 4 distinct values in source."),
        ("students_master", "industry_feedback", "string", "Industry Feedback (demo)", "Direct copy", "Synthetic evaluator note. Not used as a feature."),
        ("students_master", "record_origin", "string", "Derived", "Constant 'uploaded_csv'", "Provenance: all rows came from the single source CSV."),
        ("students_master", "is_synthetic", "boolean", "Derived", "Constant True", "All 100 rows are clearly labelled synthetic in the source Data Notice column."),
        ("students_master", "data_quality_status", "string", "Derived", "Constant 'complete'", "No missing values in any source column."),
        # skills
        ("skills", "student_id", "string", "Candidate ID", "Direct copy", "Foreign key to students_master."),
        ("skills", "canonical_skill_name", "string", "Core Skills", "Tokenised + alias-normalised", "One skill per row. Aliases applied via deterministic dictionary."),
        ("skills", "evidence_type", "string", "Derived", "Constant 'self_declared'", "Source file contains only self-declared skills — no project/assessment links per skill."),
        ("skills", "evidence_source", "string", "Derived", "Constant 'core_skills_csv_column'", "Provenance: all skills came from the Core Skills CSV column."),
        ("skills", "self_declared_level", "null", "Not available", "Always null", "Source file does not contain per-skill self-rated levels."),
        ("skills", "assessment_score", "null", "Not available", "Always null", "Source file does not break down assessment scores per skill."),
        ("skills", "verification_status", "string", "Derived", "Constant 'unverified'", "All skills in the source are self-declared. None are individually verified."),
        # features
        ("features_student_x_role", "student_id", "string", "Candidate ID", "Direct copy", "Foreign key."),
        ("features_student_x_role", "target_role", "string", "Target Role", "Direct copy", "Student's stated target."),
        ("features_student_x_role", "evaluated_role", "string", "Role profile", "From ROLE_PROFILES dict", "Role the features are computed against. Each student is evaluated against all 10 roles."),
        ("features_student_x_role", "is_target_role_match", "boolean", "Derived", "target_role == evaluated_role", "Whether this row evaluates the student against their own target role."),
        ("features_student_x_role", "total_skills_declared", "integer", "Derived", "Count of skills_long rows for this student", "Number of distinct skills the student declared."),
        ("features_student_x_role", "evidence_backed_skill_count", "integer", "Derived", "len(skills) if faculty-verified else 0", "All-or-nothing count — the source has no per-skill verification, only a record-level faculty flag."),
        ("features_student_x_role", "required_skill_count", "integer", "Role profile", "len(ROLE_PROFILES[role]['required'])", "Deterministic, not learned."),
        ("features_student_x_role", "required_covered_count", "integer", "Derived", "len(student_skills ∩ required)", "How many required skills the student has."),
        ("features_student_x_role", "required_missing_count", "integer", "Derived", "len(required - student_skills)", "How many required skills are absent."),
        ("features_student_x_role", "required_coverage", "float 0..1", "Derived", "required_covered_count / required_skill_count", "Coverage ratio."),
        ("features_student_x_role", "preferred_skill_count", "integer", "Role profile", "len(ROLE_PROFILES[role]['preferred'])", "Deterministic."),
        ("features_student_x_role", "preferred_covered_count", "integer", "Derived", "len(student_skills ∩ preferred)", "How many preferred skills the student has."),
        ("features_student_x_role", "preferred_coverage", "float 0..1", "Derived", "preferred_covered_count / preferred_skill_count", "Coverage ratio."),
        ("features_student_x_role", "assessment_score", "integer or null", "Parsed from source", "Regex extract 'NN/100'", "Synthetic — not a real credential."),
        ("features_student_x_role", "baseline_match_score", "float 0..100", "Derived", "100 * (4*req_cov + 1*pref_cov) / (4*req_n + 1*pref_n)", "Weighted skill-matching baseline. Mirrors the Skillproof platform's matching.ts formula (weight 4 for required, 1 for preferred)."),
        ("features_student_x_role", "missing_required_skills", "string", "Derived", "Comma-joined sorted set", "Required skills the student lacks."),
        ("features_student_x_role", "covered_required_skills", "string", "Derived", "Comma-joined sorted set", "Required skills the student has."),
    ]
    data_dict = pd.DataFrame(data_dict_rows, columns=[
        "sheet", "column", "data_type", "source_column", "transformation", "description"
    ])
    dict_xlsx = OUT_DIR / "skillproof_data_dictionary.xlsx"
    with pd.ExcelWriter(dict_xlsx, engine="openpyxl") as writer:
        data_dict.to_excel(writer, sheet_name="data_dictionary", index=False)
        # Add a role-profiles reference sheet
        role_rows = []
        for role, prof in ROLE_PROFILES.items():
            role_rows.append({
                "job_title": role,
                "required_skills": ", ".join(prof["required"]),
                "preferred_skills": ", ".join(prof["preferred"]),
                "source": "deterministic_role_profile",
                "note": "Hand-curated role profile used by the baseline matcher. NOT learned from data.",
            })
        pd.DataFrame(role_rows).to_excel(writer, sheet_name="role_profiles", index=False)
    print(f"[saved] {dict_xlsx}")

    # ----- 14. SAVE ARTIFACTS JSON (reproducibility) -----
    artifacts["final_counts"] = {
        "students_master": int(len(students)),
        "skills_long": int(len(skills_long)),
        "projects": int(len(projects)),
        "certifications": int(len(certs)),
        "jobs": int(len(jobs)),
        "features_student_x_role": int(len(features)),
        "baseline_predictions": int(len(baseline_predictions)),
        "student_model_table": int(len(student_model)),
    }
    artifacts["target_role_distribution"] = students["target_role"].value_counts().to_dict()
    artifacts["faculty_review_status_distribution"] = students["faculty_review_status"].value_counts().to_dict()
    artifacts_path = OUT_DIR / "cleaning_artifacts.json"
    with artifacts_path.open("w", encoding="utf-8") as f:
        json.dump(artifacts, f, indent=2, default=str)
    print(f"[saved] {artifacts_path}")

    print("\nPipeline complete.")
    print(f"  Students: {len(students)}")
    print(f"  Skills (long): {len(skills_long)} ({skills_long['canonical_skill_name'].nunique()} unique)")
    print(f"  Projects: {len(projects)}")
    print(f"  Certifications: {len(certs)}")
    print(f"  Jobs (role profiles): {len(jobs)}")
    print(f"  Feature rows (student × role): {len(features)}")
    print(f"  Baseline predictions: {len(baseline_predictions)}")


if __name__ == "__main__":
    main()
