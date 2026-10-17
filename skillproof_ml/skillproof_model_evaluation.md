# Skillproof — Model Evaluation Report

**Pipeline run**: `skillproof_training.py`  
**Date**: 2026-10-17  
**Source dataset**: `Skillseto_100_Fictional_Candidates.csv` (100 rows, all labelled synthetic)

---

## 1. Verdict

**Supervised predictive training is NOT justified by this dataset.**

Per the master prompt section 7:
> "If no valid target labels exist, explicitly state that supervised predictive training is not justified by the available dataset. Prepare the feature dataset and a transparent weighted skill-matching baseline instead, and specify what additional labels need to be collected."

This report:
1. Documents why supervised training was not performed.
2. Implements and evaluates a transparent rules-based weighted skill-matching baseline.
3. Lists the exact additional labels that would need to be collected to justify future supervised training.
4. Saves an ML-ready feature table with explicit null target columns for future labelling.

---

## 2. Why no supervised model was trained

### 2.1 Label availability assessment

| Label candidate | Available in source? | Verdict |
|---|---|---|
| Recruiter-reviewed fit label (e.g. {poor, weak, moderate, strong, excellent}) | ❌ No | Cannot be used as a supervised target. |
| Historical hiring outcome (e.g. {rejected, screening, interviewed, offered, hired}) | ❌ No | Cannot be used as a supervised target. |
| `Faculty Review Status (demo)` | ✅ Yes (4 values × 25 students) | **Verification flag, NOT a fit/hiring label.** Values are `Pending review / Verified by faculty / Changes requested / Not submitted` — these describe the verification workflow state of the record, not the student's actual fit for any role. Using this as a target would conflate "was the record reviewed" with "is the student a good fit", which is misleading. |
| `Assessment Result (demo)` score | ✅ Yes (62–98, mean 80.28) | **Synthetic demo score, not a real credential.** Every row in the source is explicitly labelled `"SYNTHETIC DEMO DATA — NOT A REAL PERSON"`. The assessment scores were generated, not administered. Using them as a target would predict the synthetic score generator, not real-world proficiency. |

**Conclusion**: 0 of the 1000 (student × role) feature rows have a real supervised label. Per the master prompt, supervised training is not justified.

### 2.2 Class imbalance

The `Faculty Review Status` column — the only candidate label — is perfectly balanced (25 students × 4 statuses), but it is a verification flag, not a fit label. So "class imbalance" is not even the right framing.

If real fit labels were collected in the future (e.g. {poor, weak, moderate, strong, excellent}), class imbalance would need to be addressed. For a campus placement scenario, the natural distribution is likely long-tailed (most students are "moderate" with fewer "strong" and "poor") — but this is speculation without real labels.

---

## 3. Baseline matching method

The baseline implements the **weighted skill-coverage** formula that mirrors the Skillproof platform's `src/lib/matching.ts` engine:

```
score = 100 × (4 × required_covered + 1 × preferred_covered) / (4 × required_total + 1 × preferred_total)
```

- `required` skills have weight **4**
- `preferred` skills have weight **1**
- A student's skill counts as "covered" if it appears in their `Core Skills` column (after deterministic alias normalisation)
- Evidence verification is NOT used in the score (because the source has only a record-level faculty flag, not per-skill verification)

This baseline is fully deterministic, transparent, and reproducible. It does not learn from data.

---

## 4. Baseline evaluation

### 4.1 Proxy sanity check

For each student, we computed the rank of their **own target role** in the baseline's ranking of all 10 roles. This is a sanity check of internal consistency — NOT a model accuracy metric.

| Metric | Value |
|---|---|
| Target role ranked #1 (out of 10 roles) | **44 / 100 (44.0%)** |
| Target role in top 3 | **72 / 100 (72.0%)** |
| Target role in top 5 | **78 / 100 (78.0%)** |
| Mean target-role rank | **3.08 / 10** |

**⚠️ Important interpretation**: this is NOT a model accuracy. The source's `Core Skills` column was authored to match each student's target role, so the baseline mechanically ranks the target role higher. The fact that 44% (not 100%) of students have their target role ranked #1 reflects that:
- Some students have generic skills (e.g. `Python, OOP, REST APIs, Git`) that match multiple roles equally well
- The hand-curated `ROLE_PROFILES` may include specialised skills (e.g. `Figma` for UI/UX) that the source's skill tokens don't perfectly cover

This sanity check confirms that the baseline is internally consistent — it does not confirm predictive accuracy on real-world hiring.

### 4.2 Per-role baseline distribution

The table below shows the baseline match-score distribution across all 100 students for each role:

| Evaluated role | Mean | Median | Min | Max | Std |
|---|---:|---:|---:|---:|---:|
| Python Developer | 10.70 | 0.0 | 0.0 | 85.00 | 15.70 |
| Backend Developer | 12.20 | 0.0 | 0.0 | 60.00 | 15.64 |
| Full-Stack Developer | 9.33 | 0.0 | 0.0 | 83.33 | 15.81 |
| Data Analyst | 8.40 | 0.0 | 0.0 | 60.00 | 13.39 |
| Frontend Developer | 7.70 | 0.0 | 0.0 | 60.00 | 15.22 |
| Machine Learning Intern | 6.00 | 0.0 | 0.0 | 20.00 | 9.21 |
| QA Automation Engineer | 6.20 | 0.0 | 0.0 | 30.00 | 9.51 |
| Cloud / DevOps Intern | 2.50 | 0.0 | 0.0 | 40.00 | 6.38 |
| Cybersecurity Analyst | 2.10 | 0.0 | 0.0 | 20.00 | 4.27 |
| UI/UX Designer | 2.00 | 0.0 | 0.0 | 20.00 | 5.50 |

**Observations**:
- Median score is 0 for every role — most students don't have ANY of the required skills for roles outside their target.
- The specialised roles (Cybersecurity, UI/UX, Cloud/DevOps) have very low mean scores because few students declare specialised skills like `Figma` or `Cryptography basics`.
- The generalist roles (Python, Backend, Full-Stack) have higher mean scores because their required skills (Python, REST APIs, Git) are more commonly declared.

### 4.3 Top-3 candidates per role (from the baseline)

These are the candidates the baseline would shortlist for each role. The full ranked list is in `skillproof_baseline_predictions.csv`.

(Saved in `skillproof_baseline_evaluation.json` → `proxy_sanity_check.top_k_counts` for the full numbers.)

---

## 5. ML-ready feature table

A feature table was prepared for future supervised training when real labels are collected:

- **File**: `skillproof_ml_ready_features.csv` (1000 rows = 100 students × 10 roles)
- **Target columns**: `target_fit_label`, `target_label_source`, `target_label_date` — all **null** by default. These are to be filled when real recruiter-reviewed fit labels or historical hiring outcomes are collected.
- **Feature columns**: same as `skillproof_features.csv` (total_skills_declared, evidence_backed_skill_count, required/preferred coverage ratios, assessment_score, baseline_match_score, etc.)

When real labels are collected, the training script should:
1. Load `skillproof_ml_ready_features.csv`
2. Join the real labels on `(student_id, evaluated_role)` to populate `target_fit_label`
3. Verify train/validation separation by `student_id` (keep all of a student's rows in the same partition) to prevent leakage
4. Fit preprocessing on the training partition only
5. Start with a simple interpretable model (logistic regression or shallow decision tree)
6. Compare against the baseline match score as the reference baseline
7. Report precision, recall, F1, and ROC-AUC, plus class counts and uncertainty

---

## 6. Required additional labels for supervised training

To justify future supervised training, the following labels would need to be collected:

1. **Recruiter-reviewed fit label per (student, job) pair** — e.g. `{poor, weak, moderate, strong, excellent}`. Should be collected via a documented rubric (e.g. 5-point Likert scale anchored to specific evidence requirements).

2. **Historical application outcomes per (student, job) pair** — e.g. `{rejected, screening, interviewed, offered, hired, withdrew}`. These are downstream of the fit prediction, so they should be used with care to avoid label leakage.

3. **Sample size** — at least **200-500 labelled (student, job) pairs** across multiple roles for a meaningful train/validation split. 100 students × 10 roles = 1000 pairs would be the minimum useful size.

4. **Per-skill verification status** (not just a record-level faculty flag) — so evidence-backed skills can be distinguished from self-declared ones at the feature level.

5. **Documented labelling protocol** (who labelled, when, rubric, inter-rater reliability) for reproducibility.

6. **Real assessment scores** (not synthetic demo scores) — the source's `Assessment Result (demo)` column contains scores explicitly labelled as synthetic.

---

## 7. What was NOT done (and why)

| Step | Done? | Reason |
|---|---|---|
| Train/test split by student | ❌ | No supervised labels to split. |
| Logistic regression | ❌ | No supervised labels. |
| Decision tree / Random forest | ❌ | No supervised labels. |
| ROC-AUC / F1 / precision-recall | ❌ | No supervised labels. |
| Hyperparameter tuning | ❌ | No supervised labels. |
| Feature selection via model coefficients | ❌ | No supervised model. |
| **Rules-based weighted baseline** | ✅ | Implemented + evaluated transparently. |
| **ML-ready feature table** | ✅ | Saved with explicit null target columns. |
| **Proxy sanity check** | ✅ | Reports target-role rank distribution (44% top-1, 72% top-3). Documented as internal consistency, NOT accuracy. |
| **Class-imbalance report** | ✅ | Documents that `Faculty Review Status` is balanced but NOT a fit label. |
| **Leakage prevention guidance** | ✅ | Future training must keep all of a student's rows in the same partition. |

---

## 8. Files produced by this evaluation

| File | Description |
|---|---|
| `skillproof_baseline_evaluation.json` | Structured evaluation summary (verdict, baseline method, proxy sanity check, per-role distribution, label availability, required additional labels) |
| `skillproof_ml_ready_features.csv` | Feature table with explicit null `target_fit_label` columns for future labelling |
| `skillproof_baseline_predictions.csv` | Ranked candidates per role (sorted by baseline_match_score desc) |

---

## 9. Honest summary

- ✅ A complete, transparent, reproducible data pipeline was built.
- ✅ The 100-student dataset was constructed from the source file with full provenance.
- ✅ Linked tables (skills, projects, certifications, jobs) were produced without flattening relationships.
- ✅ Features were engineered with documented definitions and missing-value treatment.
- ✅ A rules-based weighted skill-matching baseline was implemented and evaluated transparently.
- ✅ An ML-ready feature table was prepared for future supervised training.
- ❌ **No supervised model was trained** — the source dataset contains no real supervised labels, and per the master prompt we explicitly do not fabricate labels or training results.
- ❌ **No model accuracy is reported** — the 44% top-1 sanity-check figure is internal consistency, NOT predictive accuracy, and is documented as such.

Per the master prompt's instruction:
> "Do not claim that a file was created, training was executed, or a model was evaluated unless it actually happened in the available environment."

Everything reported here actually happened in this environment. Nothing was fabricated.
