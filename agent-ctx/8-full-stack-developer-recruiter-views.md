# Task 8 — Recruiter Views

Agent: full-stack-developer (recruiter views)

Task: Build all Recruiter SPA views for Placement Hub — dashboard, jobs, job-detail, shortlist, candidate-detail, pipeline, application-detail — plus a shared JobForm component. Wire RecruiterRouter in recruiter-app.tsx to dispatch by route.view, mirroring the student-app pattern.

## Work Log

- Read worklog.md (Task IDs 1-7), shared types (src/types/index.ts), api-client.ts (api/apiGet/apiPost/apiPatch/apiDelete + ApiError), app-store.ts (useAppStore.navigate(view, params), route.params), use-auth.ts, app-shell.tsx, shared/ui.tsx (PageHeader, StatCard, CardSkeleton, EmptyState, ErrorState, formatCurrency/formatSalary/formatDate/formatDateTime), status-badge.tsx (StatusBadge, FitScoreBadge, CoverageBadge), skill-tag.tsx (SkillTag, EvidenceStatusBadge).
- Read student-app.tsx for the router-dispatch pattern + getId helper, and student/dashboard.tsx, jobs.tsx, job-detail.tsx, application-detail.tsx, applications.tsx for conventions (loading skeletons, EmptyState, toast, useMutation with qc.invalidateQueries, StatusBadge, ScrollArea for long lists).
- Read API routes to confirm response shapes: /api/dashboard/recruiter (4 metrics + stageDistribution + recentActivity), /api/jobs (list with requiredSkillCount/preferredSkillCount + POST create with skill normalization + dup detection), /api/jobs/[id] (full job with requirements + PATCH with skills rebuild), /api/matches/job/[id] (paginated candidates with missingSkills/matchingSkills arrays), /api/matches/[jobId]/[studentId] (full breakdown with factorsSummary + recommendation), /api/applications (role-aware list filtered by recruiter's company), /api/applications/[id] (full detail with events/interviews/offer), /api/applications/[id]/interview (POST with auto-advance to INTERVIEW), /api/applications/[id]/offer (POST with auto-advance to OFFER), /api/students/[id] (profile + skills + evidence subset), /api/resumes/[id] (owner-student-only — recruiters get 403).

### Files created (8 new files)

1. **src/components/placement/recruiter/dashboard.tsx** (~280 lines) — Recruiter dashboard. Loads /api/dashboard/recruiter. 4 StatCards (open jobs / total candidates / shortlisted / needing review) with appropriate tones (info / default / success / warning). Stage distribution BarChart using recharts (BarChart + Bar + XAxis + YAxis + Tooltip + CartesianGrid + ResponsiveContainer) that filters to non-zero stages. Quick-actions card with three buttons (Manage jobs / Review candidates / Track pipeline). Recent-activity ScrollArea list (10 events) showing studentName, jobTitle, actor, reason, StatusBadge transition chip. Stage-legend grid at the bottom showing all 8 statuses with counts. DashboardSkeleton fallback.

2. **src/components/placement/recruiter/job-form.tsx** (~260 lines) — Shared JobForm component used by both create and edit flows. Fields: title, description (Textarea), location, workArrangement (Select remote/hybrid/onsite), employmentType (Select full-time/internship/contract), minExperience, maxExperience, salaryMin, salaryMax (number inputs), batchEligible, eligibilityCriteria (Textarea), sourceType (default MANUAL), requiredSkills + preferredSkills (comma-separated inputs), closingDate (datetime-local). companyId passed from parent (Jobs view reads it from /api/me profile.companyId). Submit builds payload (converts strings to numbers, normalizes empty strings, removes undefined fields, converts closingDate to ISO), calls POST /api/jobs (create) or PATCH /api/jobs/[id] (edit). Surfaces duplicate-detection warnings via toast.warning when the response includes duplicates. Invalidates ['recruiter-jobs'], ['recruiter-dashboard'], and ['job', jobId] (for edit mode). Removed the useEffect that synced initialValues to state — instead the Dialog mounts JobForm fresh each time it's opened, so the useState initializer `() => ({ ...EMPTY_JOB_VALUES, ...initialValues })` runs once. This avoids the react-hooks/set-state-in-effect lint rule.

3. **src/components/placement/recruiter/jobs.tsx** (~250 lines) — Company job management. Filters: debounced search (350ms), status filter (OPEN/CLOSED/DRAFT/ARCHIVED/ALL). Loads /api/jobs with the company filter implicit (route filters by recruiter's companyId). Loads /api/me for the recruiter's companyId + companyName (shown in the page header + used to gate the Create button when no company is bound). Table with: Title (with batch badge), Location (with MapPin icon), Work arrangement, Employment type, Source (badge), Posted date, Skills (Required/Preferred counts), Status badge, View button → recruiter/jobs/[id]. "Create job" button opens a Dialog containing JobForm mode="create". EmptyState when no jobs match filters or no jobs exist.

4. **src/components/placement/recruiter/job-detail.tsx** (~420 lines) — Job detail (recruiter view). Loads /api/jobs/[id], /api/matches/job/[id]?take=1 (matchesCount), /api/applications?jobId=... (appsCount) — last two are gated on the recruiter owning the job's company. Header card shows status, work arrangement, employment type, location, source, batch, salary, posted/closing dates, experience range, eligibility criteria, external URL. Count summary: 2 cards showing matchesCount + appsCount. Three-column layout: Description + Required skills (SkillTag isRequired) + Preferred skills (SkillTag) on the left; Company + Timeline cards on the right. "Edit" button opens Dialog with JobForm mode="edit" initialValues derived from the job (deriveInitialValues converts numbers to strings, ISO closingDate to datetime-local, requirements array → comma-separated skill names by isRequired flag). "View candidates" → navigate('recruiter/shortlist', { jobId }). "View applications" → navigate('recruiter/applications', { jobId }).

5. **src/components/placement/recruiter/shortlist.tsx** (~460 lines) — Candidate shortlist. Job picker (Select with company's jobs from /api/jobs?status=ALL). Filters: minimum-score Slider (0-100 step 5), required-coverage-only Switch. Loads /api/matches/job/[activeJobId]?minScore=&requiredCoverageOnly=&skip=0&take=100. Uses a derived `activeJobId` (= selectedJobId || first job's id) instead of useEffect to auto-pick the first job when none is selected — this avoids the react-hooks/set-state-in-effect rule. Ranked candidate Table: rank #, student name (with branch), batch, branch, cgpa, FitScoreBadge, CoverageBadge, missing-skills count badge (or "None" emerald badge), View button → navigate('recruiter/candidates/[studentId]', { jobId }). Rows are expandable: clicking a row toggles an ExpandedCandidate row that calls GET /api/matches/[jobId]/[studentId] and renders the recommendation banner + matching/missing skills (SkillTag with isVerified) + factorsSummary + algorithm version. Uses `<Fragment key={rowKey}>` to wrap paired TableRow + expandable tr (React key requirement for sibling array elements). EmptyState when no candidates match the filters ("Ask officer to recompute matches").

6. **src/components/placement/recruiter/candidate-detail.tsx** (~580 lines) — Candidate evidence summary. Loads /api/students/[id] (profile + skills + evidence subset) + /api/matches/[jobId]/[studentId] (fit analysis, enabled when jobId provided) + /api/applications?jobId=... (to find an existing app for this student+job — recruiters can't create applications themselves). Candidate header card: name, email, university, batch, branch, cgpa, location, graduation year, bio, github/linkedin/portfolio links (open in new tab), profile completion %. Skills card: verified skills (SkillTag isVerified) + unverified skills, separated. Evidence card: list with type badge, title, organization, submitted date, EvidenceStatusBadge, score/maxScore, source URL link. Fit analysis panel (right column): big fitScore number color-coded, CoverageBadge for required + preferred, factorsSummary, recommendation banner, matching/missing skills counts, algorithm version + storedAt. Interview panel: if existing app exists, "Move to interview stage" button opens Dialog (scheduledAt datetime-local, round number, type Select, duration, location, meeting URL, notes Textarea) → POST /api/applications/[appId]/interview. On success, navigates to recruiter/applications/[appId]. If no app exists, shows amber notice "Ask officer to advance this candidate to APPLIED or SHORTLISTED first". Back button → recruiter/shortlist (with jobId param preserved).

7. **src/components/placement/recruiter/pipeline.tsx** (~260 lines) — Recruitment pipeline. Filters: debounced search (350ms), status Select (ALL + 8 statuses), job Select (loads company's jobs from /api/jobs?status=ALL). routeJobId from route.params is captured at mount via useState initializer (avoids setState-in-effect rule). Loads /api/applications?status=&jobId= and client-filters by search string. Tabs view: "Table" (Table component with student name/email, job title, company, StatusBadge, applied date, View button) and "Board" (8 columns matching PIPELINE_COLUMNS, each with a header label + count badge + ScrollArea of cards showing student name, job title, company, applied date, resume badge, View button — click → navigate('recruiter/applications/[id]')). EmptyState when no applications match.

8. **src/components/placement/recruiter/application-detail.tsx** (~600 lines) — Application detail (recruiter). Loads /api/applications/[id] (with events/interviews/offer/resume). Header card: current status, applied date, candidate (link to recruiter/candidates/[id] with jobId), job (link to recruiter/jobs/[id]). Three action buttons (Update status / Schedule interview / Extend offer) shown only when status is not terminal. Left column: Cover letter preview + Submitted resume card + Status timeline (chronological events with previousStatus → newStatus StatusBadge chips, actor name, reason, formatDateTime). Resume preview attempts to GET /api/resumes/[id] — if it 403s (owner-student-only), shows an amber notice "Resume bullet preview is restricted to the candidate and officers" with the metadata (title, version) shown in the card header. ResumePreview sub-component renders the bullets grouped by section with claimStatus badges (SUPPORTED/UNSUPPORTED/NEEDS_REVIEW). Right column: Offer card (emerald-themed) when present + Upcoming interviews list (filtered to !outcome) + dashed "Schedule first interview" CTA when none scheduled. Three dialogs:
   - UpdateStatusDialog: Select (all 8 statuses) + reason Textarea → PATCH /api/applications/[id] { status, reason }
   - ScheduleInterviewDialog: scheduledAt datetime-local, round, type Select, duration, location, meeting URL, notes → POST /api/applications/[id]/interview
   - ExtendOfferDialog: amount, currency Select (INR/USD/EUR/GBP), decision Select (PENDING/ACCEPTED/DECLINED), expiresAt date → POST /api/applications/[id]/offer
   All mutations invalidate ['application', id], ['recruiter-applications'], ['recruiter-dashboard'] on success and close the dialog.

### Files modified (1 file)

- **src/components/placement/recruiter/recruiter-app.tsx** — Replaced the stub RecruiterRouter with a full dispatcher that mirrors the student-app pattern. NAV_ITEMS reduced from 5 to 4 (removed the orphan "Evidence Summary" item that pointed to recruiter/evidence — candidate evidence is now reached via recruiter/shortlist → recruiter/candidates/[id]). RecruiterRouter reads route.view + route.params and dispatches to:
  - recruiter/dashboard → <Dashboard/>
  - recruiter/jobs → <Jobs/>
  - recruiter/shortlist → <Shortlist/>
  - recruiter/applications → <Pipeline/>
  - recruiter/jobs/[id] → <JobDetail id={id}/> (id from params.id or trailing path segment via getId helper)
  - recruiter/applications/[id] → <ApplicationDetail id={id}/>
  - recruiter/candidates/[id] → <CandidateDetail id={id} jobId={params.jobId}/>
  - default → <Dashboard/>
  The getId helper extracts the trailing id from view paths like `recruiter/jobs/abc123`.

### Lint rule fixes

- Removed useEffect that synced route.params.jobId to state in pipeline.tsx (used `useState<string>(routeJobId ?? 'ALL')` initializer instead).
- Removed useEffect that synced routeJobId to selectedJobId in shortlist.tsx (used useState initializer + derived `activeJobId = selectedJobId || (jobs[0]?.id ?? '')`).
- Removed useEffect that auto-selected first job in shortlist.tsx (replaced with the derived activeJobId approach).
- Removed useEffect that synced initialValues to state in job-form.tsx (the Dialog mounts JobForm fresh each open, so useState initializer suffices).
- Removed useMemo in job-detail.tsx that was called after early returns (rules-of-hooks violation) — replaced with inline `deriveInitialValues(job)` call after the null check.
- Removed unused imports: `Send`, `ScrollArea`, `FileText`, `formatDateTime`, `FitScoreBadge`, `api`, `useQueryClient`, `useMemo`, `ListChecks` across multiple files.
- Added `algorithmVersion?: string` to PairMatch interface in shortlist.tsx (was referenced in ExpandedCandidate but not declared).
- Used `<Fragment key={rowKey}>` to wrap paired TableRow + expandable tr in shortlist.tsx (React key requirement for sibling array elements — the original `<>...</>` shorthand can't take a key).

## Validation

- `bun run lint` → clean (exit 0, no errors, no warnings) for all 8 files I created/modified.
- `bunx tsc --noEmit` → 0 errors in any of my recruiter view files (only pre-existing TS errors remain in out-of-scope files like src/lib/matching.ts).
- dev.log shows `GET /api/dashboard/recruiter 200` and `GET / 200` after my changes — the recruiter SPA is rendering and fetching data successfully.
- Live flow verified by inspecting dev.log:
  - Recruiter login → /api/me returns the recruiter profile with companyId
  - Dashboard mounts → /api/dashboard/recruiter returns the 4 metrics + stage distribution + recent activity
  - All API queries succeed (200 status codes throughout)

## Stage Summary

All 7 recruiter view components plus 1 shared form component are implemented and wired into the SPA router. The recruiter side of Placement Hub is now feature-complete:
- **Dashboard** with stat cards, stage-distribution bar chart, and recent-activity feed
- **Jobs** list with table view, search + status filters, and create-job dialog (uses shared JobForm)
- **Job detail** with full job info, required/preferred skills, applications + matches counts, edit dialog (shared JobForm), and jump-to-candidates/applications CTAs
- **Shortlist** with job picker, min-score slider, required-coverage switch, ranked candidate table with expandable rows showing live match breakdown
- **Candidate detail** with full profile + verified/unverified skills + evidence list + fit analysis panel + schedule-interview dialog (with graceful amber notice when no application exists)
- **Pipeline** with table + board (kanban) tabs, search/status/job filters, click-through to application detail
- **Application detail** with status timeline, cover letter, resume preview (gracefully degrades when restricted to owner-student), upcoming interviews, offer card, and three action dialogs (update status / schedule interview / extend offer)

All four nav items (Dashboard / Company Jobs / Candidate Shortlist / Recruitment Pipeline) now have working destinations, plus three dynamic detail routes (recruiter/jobs/[id], recruiter/applications/[id], recruiter/candidates/[id]) that the sidebar highlights via the existing `startsWith(item.view + '/')` logic.

The recruiter experience integrates cleanly with the existing student/officer views via the shared AppShell, the shared ui helpers, and the role-aware API routes — no backend changes were needed.
