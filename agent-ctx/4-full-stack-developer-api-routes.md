# Task 4 — full-stack-developer (api routes) — Work Record

## Task
Build ALL Next.js 16 App Router API routes for "Placement Hub" — an evidence-based campus placement platform — covering students & profile, skills & student-skills, evidence (student + officer review), jobs (with CSV import + duplicate detection + duplicate resolution), matching & ranking (incl. recompute + CSV), applications (with events, interviews, offers), resumes (generate, validate, PDF stub), dashboards (student/officer/recruiter), notifications, audit log, and job sources sync stub.

## Files Created

### Shared helpers (new file, not modifying existing libs)
- `src/lib/api-helpers.ts` — requireUser, requireStudentProfileId, requireRecruiterCompanyId, getPagination, notifyUsers, getOfficerUserIds, getRecruiterUserIdsForCompany, getStudentUserId, safeParseJson, computeProfileCompletion
- `src/lib/match-compute.ts` — `computeMatchFor(jobId, studentId)` + `upsertMatchResult(...)` thin wrapper around `calculateMatch` from matching.ts

### Students & profile
- `src/app/api/students/route.ts` (GET — list with filters)
- `src/app/api/students/[id]/route.ts` (GET — full profile detail)
- `src/app/api/students/profile/route.ts` (PATCH — own profile update, recalculates profileCompletion)

### Skills
- `src/app/api/skills/route.ts` (GET — all canonical skills + aliases)
- `src/app/api/skills/normalize/route.ts` (POST — batch normalize via normalizeSkills())

### Student skills
- `src/app/api/student/skills/route.ts` (GET list, POST add-or-return-existing)
- `src/app/api/student/skills/[id]/route.ts` (DELETE)

### Evidence (student)
- `src/app/api/student/evidence/route.ts` (GET list, POST submit + notify officers + audit)
- `src/app/api/student/evidence/[id]/route.ts` (DELETE — blocks VERIFIED)

### Evidence (officer review)
- `src/app/api/evidence/pending/route.ts` (GET — pending queue)
- `src/app/api/evidence/[id]/route.ts` (GET — detail + reviews history)
- `src/app/api/evidence/[id]/review/route.ts` (POST — APPROVE/REJECT/REQUEST_MORE, marks StudentSkill verified if approved, audit + notify student)
- `src/app/api/evidence/history/[id]/route.ts` (GET — review history)

### Jobs
- `src/app/api/jobs/route.ts` (GET list with filters, POST create + normalize + duplicate detection — exports `runDuplicateDetection()`)
- `src/app/api/jobs/[id]/route.ts` (GET detail, PATCH update — re-runs dup detection + clears cached matches when skills change)
- `src/app/api/jobs/import-csv/route.ts` (POST — bespoke CSV parser, find-or-create company, per-row skill normalization + duplicate detection)
- `src/app/api/jobs/duplicates/route.ts` (GET — POSSIBLE/CONFIRMED list side-by-side)
- `src/app/api/jobs/duplicates/[id]/resolve/route.ts` (POST — CONFIRM_MERGE: archives older job, moves/dedupes applications in a transaction; or REJECT)

### Matches & ranking
- `src/app/api/matches/student/route.ts` (GET — own matches sorted desc)
- `src/app/api/matches/job/[id]/route.ts` (GET — paginated candidates)
- `src/app/api/matches/[jobId]/[studentId]/route.ts` (GET — live breakdown via computeMatchFor)
- `src/app/api/matches/recompute/[jobId]/route.ts` (POST — for one job, upserts for every eligible student)
- `src/app/api/matches/recompute-all/route.ts` (POST — for all OPEN jobs)
- `src/app/api/matches/ranking/route.ts` (GET — JSON or `?format=csv` returns text/csv)

### Applications
- `src/app/api/applications/route.ts` (GET — role-aware list with filters, POST — apply with unique constraint + event + fan-out notifications to officers + recruiters)
- `src/app/api/applications/[id]/route.ts` (GET — detail with events/interviews/offer, PATCH — status transition with allowed-transitions guard + OFFER auto-creates Offer record)
- `src/app/api/applications/[id]/interview/route.ts` (POST — auto-bumps application status to INTERVIEW if earlier stage)
- `src/app/api/applications/[id]/offer/route.ts` (POST — create-or-update Offer + auto-bump status to OFFER)

### Resumes
- `src/app/api/resumes/route.ts` (GET — list own)
- `src/app/api/resumes/generate/route.ts` (POST — pulls profile+education+evidence+projects+assessments; builds bullets per item with evidence IDs; marks UNSUPPORTED claims; saves Resume + ResumeBullet rows; auto-increments version per student+job)
- `src/app/api/resumes/[id]/route.ts` (GET — full resume with bullets + evidence refs)
- `src/app/api/resumes/[id]/pdf/route.ts` (GET — dynamic-imports `@/lib/pdf/resume` if present, returns 503 stub otherwise)
- `src/app/api/resumes/[id]/validate/route.ts` (GET — per-bullet claimStatus + missingEvidenceNote + unverifiedEvidenceNote)

### Dashboards
- `src/app/api/dashboard/student/route.ts`
- `src/app/api/dashboard/officer/route.ts`
- `src/app/api/dashboard/recruiter/route.ts`

### Notifications
- `src/app/api/notifications/route.ts` (GET — unread first, by createdAt desc)
- `src/app/api/notifications/[id]/read/route.ts` (POST — mark one as read)
- `src/app/api/notifications/read-all/route.ts` (POST — mark all own as read)

### Audit
- `src/app/api/audit/route.ts` (GET — paginated, OFFICER only)

### Job sources
- `src/app/api/job-sources/route.ts` (GET — list, OFFICER only)
- `src/app/api/job-sources/[id]/sync/route.ts` (POST — updates lastSyncAt, returns demo payload)

## Key implementation notes
- All routes use `getUserFromCookies(req.headers.get('cookie'))` for auth via the shared `requireUser()` helper (auth.ts was NOT modified).
- All dynamic routes use `Promise<{ id: string }>` params + `await` (Next.js 16 requirement).
- Zod `safeParse` everywhere with `ResponseError(400, ...)` on failure; all bodies wrapped in try/catch + `errorResponse(err)`.
- Role checks via `requireRole(user, ...)` from auth.ts.
- Recruiter ownership: load `recruiterProfile.companyId` via `requireRecruiterCompanyId()` and compare to job's `companyId`.
- Student ownership: load `studentProfile.id` via `requireStudentProfileId()` and compare to evidence/application's `studentId`.
- SQLite JSON workaround: all `matchingSkills`, `missingSkills`, `explanation`, `provenance`, `metadata`, `reasons`, `claimValidation`, `content`, `skillIds`, `evidenceIds` fields stored via `JSON.stringify()` and read via `safeParseJson()` helper.
- DuplicateJob has no `@@unique([jobAId, jobBId])` constraint, so `runDuplicateDetection()` uses `findFirst + create/update` instead of `upsert`.
- The Application unique `@@unique([studentId, jobId])` constraint DOES exist in the schema, so applications use `findUnique({ where: { studentId_jobId: ... } })` and PATCH path uses that for dedup-merge logic.
- Resume PDF route uses `// @ts-ignore` on the dynamic import so TypeScript doesn't fail when `@/lib/pdf/resume` is missing; runtime try/catch returns 503 stub.
- Notifications fan out via `db.notification.createMany` + `getOfficerUserIds()` / `getRecruiterUserIdsForCompany()` helpers.

## Validation
- `bun run lint` — clean (no errors).
- `bunx tsc --noEmit` — clean for all files I created. (Pre-existing errors in `examples/websocket/`, `skills/image-edit/`, `skills/stock-analysis-skill/`, and `src/lib/matching.ts` are out of scope — they belong to other agents/examples and the instructions explicitly forbade modifying matching.ts.)
- End-to-end smoke tests against running dev server with seeded data confirmed:
  - Officer dashboard: 16 students, 10 jobs, 39 pending evidence, 160 matches, 7 stage counts.
  - Student dashboard: profileCompletion, supportedSkillsCount, suitableJobsCount, recentMatches, avgFitScore, missingSkillsForTopMatch.
  - Recruiter dashboard: openJobsForCompany, totalCandidates, shortlistedCount, candidatesNeedingReview, stageDistribution, recentActivity.
  - Job create with duplicate seeded job → duplicate detection flagged similarity=0.9 with reasons ["Same title and company", "Same location", "High description similarity (100%)"].
  - Duplicate reject resolution works.
  - CSV import successfully imported 2 jobs with skill normalization.
  - Evidence submit → officer APPROVE → status=VERIFIED → review history populated.
  - Application lifecycle: APPLIED → SHORTLISTED → INTERVIEW (auto-bumped when interview scheduled) → OFFER (auto-created Offer record).
  - Resume generate produces 9 bullets (5 SUPPORTED + 4 UNSUPPORTED), validate endpoint returns per-bullet missing-evidence notes.
  - Resume PDF stub returns 503 as expected.
  - Matches recompute-all: 10 jobs × 16 students = 160 results.
  - Ranking CSV export returns text/csv with proper escaping.
  - Notifications fan-out works (students received offer + interview notifications).
  - Mark-all-read updated 4 notifications.
