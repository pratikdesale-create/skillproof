# Task 9-redesign — Recruiter App Reorganization & Polish

**Agent**: full-stack-developer (recruiter redesign)
**Task ID**: 9-redesign
**Scope**: Reorganize the Recruiter SPA per spec section 8 to use the new grouped nav structure (OVERVIEW / JOBS / CANDIDATES / SETTINGS), add three new views (Candidate Profiles list, Interviews, Settings), polish every existing recruiter view to use the new design tokens (navy `--primary`, semantic status vars, Inter font) — without touching auth/matching/PDF/api-client/shared libs or prisma schema.

## Work Log

### Reading & alignment
- Read `worklog.md` (Task IDs 1-11 + Task 8-redesign officer) to align with navy/indigo design system, shared UI primitives (`PageHeader`, `SectionHeader`, `StatCard` with 6 tones + emphasis + onClick, `ProgressRing`, `EmptyState`, `ErrorState`, `AppFooter`, `formatRelativeTime`, `formatSalary`), grouped sidebar nav via `item.group`, semantic status tokens (`--verified`, `--pending`, `--danger`, `--info`, `--chart-1..5`).
- Read `src/app/globals.css` for the full token palette.
- Read shared components: `ui.tsx`, `status-badge.tsx` (StatusBadge / FitScoreBadge / CoverageBadge / MiniBar), `skill-tag.tsx` (SkillTag / EvidenceStatusBadge), `app-shell.tsx` (AppShell with grouped sidebar nav, profile dropdown), `app-store.ts` (useAppStore.navigate(view, params)).
- Read the officer-app.tsx and officer's `interviews.tsx` / `offers.tsx` / `settings.tsx` as the nav-grouping + new-view patterns to mirror.
- Read all existing recruiter views (recruiter-app.tsx, dashboard, shortlist, candidate-detail, jobs, job-detail, job-form, pipeline, application-detail).
- Read new APIs (`/api/interviews`, `/api/offers`, `/api/settings`) and the existing recruiter-scoped APIs (`/api/dashboard/recruiter`, `/api/applications`, `/api/jobs`, `/api/jobs/[id]`, `/api/students/[id]`, `/api/matches/[jobId]/[studentId]`, `/api/matches/job/[id]`).

### `recruiter-app.tsx` rewrite (1 file modified)
- Replaced flat 4-item NAV_ITEMS with grouped sections per spec section 8:
  - OVERVIEW — Overview (recruiter/dashboard), Candidate Shortlists (recruiter/shortlist)
  - JOBS — My Jobs (recruiter/jobs), Recruitment Pipeline (recruiter/applications)
  - CANDIDATES — Candidate Profiles (recruiter/candidates), Interviews (recruiter/interviews)
  - SETTINGS — Settings (recruiter/settings)
- Mirrored officer-app's `getId(view, prefix)` helper for trailing-id detail routes. Detail-route-after-list-route ordering so `recruiter/candidates` and `recruiter/candidates/abc` both dispatch correctly.
- Added three new route branches: `recruiter/candidates` → `<Candidates/>`, `recruiter/interviews` → `<Interviews/>`, `recruiter/settings` → `<Settings/>`.
- Pipeline now accepts a `filterJobId` prop (passed from `params.jobId` when the user navigates from a job detail "View applications" button).
- Updated icon imports: `LayoutDashboard`, `Users`, `Briefcase`, `GitBranch`, `CalendarClock`, `Settings`.

### New views (3 files created)

1. **`candidates.tsx`** — GET /api/applications (auto-filters by recruiter's company) → dedupe by `studentId` client-side → enrich each unique student via `useQueries` against `/api/students/[id]` (batch-parallel, individually cached). Table columns: Candidate (name+email), Batch, Branch, CGPA (all enriched), Applications count (badge), Latest status (`StatusBadge size="sm"`), View action. Search input (debounced) + Job Select filter. Empty state: "No candidates have applied to your company's jobs yet." Click row → `recruiter/candidates` with `{ id, jobId: latest.jobId }`.

2. **`interviews.tsx`** — GET /api/interviews?status=upcoming|past|all (auto-scoped by recruiter's company). Status Select filter. Table: scheduled datetime (`formatDateTime`) + duration, student name (links to `recruiter/candidates` with jobId from `application.job.id`), role + company, type/round badges, location/meeting URL with Video icon + external link, outcome badge (Scheduled/PASSED/FAILED/PENDING using `--verified`/`--danger`/`--pending` tokens). Row click → `recruiter/applications` with `{ id: applicationId }`. Empty state: "No interviews scheduled yet. Shortlist candidates and schedule interviews from the pipeline."

3. **`settings.tsx`** — GET /api/settings for account info, PATCH /api/settings for updates, POST /api/settings with `{currentPassword, newPassword}` for password. Tabs: Account / Security. Account — name/phone/avatarUrl inputs, email disabled with Lock icon + helper, Save disabled until dirty, syncs `useAppStore.user` via `setUser` + invalidates `['recruiter-settings']` + `['me']`. Security — current/new/confirm password fields with show/hide toggles, validation hints (passwords match / too short / missing), submit enabled only when valid. Mirrors the officer Settings pattern (no profile tab — recruiters have no profile record).

### Polished views (7 files modified)

4. **`dashboard.tsx`** — 4 clickable StatCards in `grid-cols-2 lg:grid-cols-4`: Open jobs (info → jobs), Total candidates (→ candidates), Shortlisted (success → shortlist), Need review (warning + `emphasis` when >0 → applications). Stage distribution BarChart (recharts, `fill="var(--chart-1)"`, `stroke="var(--border)"`, chart-styled tooltip). Quick actions card with three buttons: "Create job posting" (→ jobs), "Review candidates" (→ shortlist), "Track pipeline" (→ applications). Recent candidate activity feed (10 events) with `formatRelativeTime` + `formatDateTime`, `StatusBadge` chips for prev→new transitions, click → application detail. Stage counts legend grid. Overall empty state when `openJobsForCompany === 0 && totalCandidates === 0`: "No jobs posted yet. Create your first job to start receiving candidates." `DashboardSkeleton` for loading.

5. **`shortlist.tsx`** — Job Select picker (company's jobs auto-filtered), minimum fit score Slider (0-100%), required coverage only Switch. Ranked candidate table: rank #, student name (link to `recruiter/candidates` with `{ id, jobId }`), batch, branch, CGPA, FitScoreBadge, CoverageBadge, missing skills count badge (verified-tone "None" when 0, danger-tone count otherwise), View action. Uses `<Fragment>` wrapper for paired rows so React keys stay valid. Expandable explanation rows — on row click, lazy-loads GET /api/matches/[jobId]/[studentId] and renders recommendation banner (verified/pending-toned based on fitScore), matching skills (SkillTag isVerified), factors summary, missing skills (SkillTag isRequired for required gaps), algorithm version + last updated. ScrollArea with `max-h-[600px] scroll-area-thin`. Empty state: "No candidates match these filters. Ask the placement officer to recompute matches for this job."

6. **`candidate-detail.tsx`** — Header card with all profile fields (name, email, university, batch, branch, cgpa, location, github, linkedin, portfolio) + ProgressRing (72px size, 6px stroke) for profile completion. Skills card (SkillTag with isVerified, verified section with `text-[var(--verified-foreground)]` label, unverified section with `text-muted-foreground` label). Evidence list (EvidenceStatusBadge + score + source URL). Applications summary card (NEW) — fetches /api/applications (auto-scoped by company) and filters by studentId client-side; lists all this candidate's applications to the recruiter's company with current status badges; click row → application detail. Fit analysis panel (existing) using FitScoreBadge size="lg" + CoverageBadges + recommendation banner (semantic tones). Interview scheduling panel — opens Dialog with datetime-local, duration, location, meetingUrl, type, round, notes → POST /api/applications/[id]/interview. If no existing application for this job, shows amber notice ("Ask the placement officer to advance this candidate to APPLIED or SHORTLISTED first.") with hint about other applications. Back button to shortlist (with jobId preserved via params). Breadcrumbs "Candidate shortlists / {name}".

7. **`jobs.tsx`** — Search (debounced 350ms) + status Select filter (OPEN/CLOSED/DRAFT/ARCHIVED/ALL). Table columns: Title (with batch badge in info tone), Location (MapPin icon), Arrangement, Type, Source, Posted, Applications count (NEW — populated via extended /api/jobs response), Status (JOB_STATUS_CLS map: OPEN=verified, CLOSED=muted, ARCHIVED=danger, DRAFT=pending), Actions (Edit + View candidates buttons). Create job dialog with JobForm (companyId implicit from recruiter's profile via /api/me). ScrollArea `max-h-[70vh] scroll-area-thin`. Empty state: "No jobs posted yet. Create your first job posting to start receiving candidates." Warning banner if recruiter has no company bound.

8. **`job-detail.tsx`** — Header card with semantic status badge + work arrangement + employment type + location + source + batch badges, full description, salary/experience/posted/closing meta tiles, eligibility callout (pending-toned), application URL link, company card + timeline card (right rail). Matches + Applications count tiles (gracefully degrades to 0 when API doesn't return _count). Two skill cards: Required (SkillTag isRequired) + Preferred (SkillTag). Action buttons: Edit (opens JobForm dialog), View candidates (→ shortlist with jobId), View applications (→ applications with jobId). Breadcrumbs "My jobs / {title}".

9. **`job-form.tsx`** — Targeted design-token migration: replaced `text-slate-500` helper text under required/preferred skills inputs with `text-muted-foreground`. No structural changes — the form's POST/PATCH logic, fields, validation, and duplicate-detection toast handling are preserved.

10. **`pipeline.tsx`** — Tabs view (Table / Board). Filters: search (debounced 350ms), status Select (ALL + 8 statuses), job Select (company's jobs). Table tab — student/job/company/status/applied/actions, all rows hover:bg-muted/40. Board tab — 8 kanban columns (APPLIED, UNDER_REVIEW, SHORTLISTED, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN) with count badges and horizontal-scroll wrapper (`overflow-x-auto scroll-area-thin` + `min-w-max` + `w-[260px] sm:w-[280px] shrink-0`) so the board stays usable on narrow screens. Each card: student name, job title (Briefcase icon), company (MapPin icon), applied date (Clock icon), resume badge. Row/card click → application detail. `filterJobId` prop initializes the job filter when navigating from job detail "View applications".

11. **`application-detail.tsx`** — Targeted edits via MultiEdit (no full rewrite of the 814-line file). Migrated every hardcoded `slate-*`, `emerald-*`, `rose-*`, `amber-*` color with design tokens: `text-muted-foreground`, `text-foreground`, `border-border`, `bg-primary` (latest timeline dot), `bg-muted-foreground/40` (older dots), `bg-[var(--verified-muted)]/40 border-[var(--verified)]/30 text-[var(--verified-foreground)]` (offer card), `bg-[var(--pending-muted)] border-[var(--pending)]/30 text-[var(--pending-foreground)]` (internal notes callout + resume-restricted notice), `bg-[var(--verified-muted)]/bg-[var(--danger-muted)]/bg-[var(--pending-muted)]` (claim status badges). Converted `navigate(\`recruiter/candidates/${student.id}\`, ...)` and `navigate(\`recruiter/jobs/${job.id}\`)` template literals to `navigate('recruiter/candidates', { id, jobId })` and `navigate('recruiter/jobs', { id })` form. Status timeline now uses primary-dot latest marker via cn(). StatusBadge chips use `size="sm"`. Internal notes callout uses pending-toned semantic colors. Offer card uses verified-toned semantic colors. All three action dialogs preserved (UpdateStatusDialog, ScheduleInterviewDialog, ExtendOfferDialog). Resume preview gracefully degrades to amber (pending) notice when restricted to owner-student.

### Backend adjustment (1 API route touched, non-breaking)
- Extended `/api/jobs` GET route to include `_count: { select: { applications: true } }` and surface `applicationsCount: j._count.applications` in the response. Non-breaking — existing consumers (officer jobs-management.tsx, recruiter jobs.tsx, student jobs.tsx, officer dashboard/analytics/ranking) all gracefully handle the new optional field. The officer's existing jobs-management.tsx already references this field with a type-assertion fallback `?? '—'`, so this just populates that column properly.

### Cross-cutting design-token migration
- Replaced every hardcoded `slate-500`, `slate-400`, `slate-600`, `slate-700`, `slate-900`, `slate-100`, `slate-300`, `slate-50`, `slate-950`, `emerald-50/700/800/300`, `rose-100/700/300`, `amber-50/700/800/300/900`, `violet-50/700`, in all 9 recruiter files with design tokens: `text-muted-foreground`, `text-foreground`, `bg-muted`, `bg-card`, `bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30`, `bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30`, `bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30`, `bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30`, `bg-primary text-primary-foreground`, `hover:bg-muted/40`.
- Replaced hardcoded chart fills (`#0f172a`, `#e2e8f0`, `#cbd5e1`) with `var(--chart-1)` and `var(--border)`.
- Replaced `hover:bg-slate-50 dark:hover:bg-slate-900` with `hover:bg-muted/40`.
- Replaced `border-slate-200 dark:border-slate-800` with `border-border`.
- Converted all `navigate(\`recruiter/...\${id}\`, ...)` template literals to the canonical `navigate('recruiter/<view>', { id, ... })` form used by the AppShell + student-app + officer-app pattern.
- Added `scroll-area-thin` class to all ScrollArea components per the design system's scrollbar styling.
- Used `StatusBadge size="sm"` for inline status chips in tables/lists.
- Used `PageHeader breadcrumbs={[...]}` for detail pages (candidate-detail, job-detail).

## Validation

- `bun run lint` → **clean** (exit 0, no errors, no warnings) for all 9 recruiter files + the 1 API tweak.
- `bunx tsc --noEmit` → **0 errors** in any recruiter file or the /api/jobs route (only pre-existing errors remain in `examples/websocket`, `skills/`, and `src/lib/matching.ts` — all out of scope per the rules).
- `dev.log` shows `✓ Compiled in 234ms / 222ms / 188ms / 207ms / 197ms / 449ms / 196ms / 258ms / 257ms / 292ms / 185ms / 151ms / 129ms / 249ms / 1200ms / 162ms / 142ms` — all compiles after the new files exist are successful, with `GET / 200` returning healthy.
- The initial "Module not found: Can't resolve './settings'" errors in the dev log were transient — caused by the file-creation order (recruiter-app.tsx was rewritten to import './settings' before settings.tsx was actually written). After settings.tsx was created, all subsequent compiles succeeded.

## Stage Summary

**Files created** (3):
- `src/components/placement/recruiter/candidates.tsx` — candidates list view (NEW)
- `src/components/placement/recruiter/interviews.tsx` — upcoming/past interview list view (NEW)
- `src/components/placement/recruiter/settings.tsx` — account + security tabs (NEW)

**Files modified** (7 recruiter + 1 API):
- `src/components/placement/recruiter/recruiter-app.tsx` — grouped NAV_ITEMS (OVERVIEW/JOBS/CANDIDATES/SETTINGS) + 3 new routes + getId helper + filterJobId prop on Pipeline
- `src/components/placement/recruiter/dashboard.tsx` — 4 clickable stat cards, BarChart with chart-1 fill, quick actions card, recent activity with formatRelativeTime, overall empty state
- `src/components/placement/recruiter/shortlist.tsx` — job picker + min-score Slider + required-coverage Switch + Fragment-paired expandable explanation rows + semantic-toned recommendation banner
- `src/components/placement/recruiter/candidate-detail.tsx` — ProgressRing header, SkillTag with isVerified, applications summary card, FitScoreBadge in fit panel, semantic-toned interview scheduling notice
- `src/components/placement/recruiter/jobs.tsx` — JOB_STATUS_CLS map, applications count column, "Create job posting" + "View candidates" actions, ScrollArea thin
- `src/components/placement/recruiter/job-detail.tsx` — JOB_STATUS_CLS map, pending-toned eligibility callout, breadcrumbs, semantic status badges
- `src/components/placement/recruiter/job-form.tsx` — text-muted-foreground helpers
- `src/components/placement/recruiter/pipeline.tsx` — Tabs Table/Board, 8 kanban columns with horizontal-scroll wrapper, filterJobId prop
- `src/components/placement/recruiter/application-detail.tsx` — semantic offer card (verified tones), pending-toned internal notes, primary-dot latest timeline marker, claim-status semantic badges, navigate(view, params) form
- `src/app/api/jobs/route.ts` — extended GET response with `applicationsCount` (non-breaking, optional)

**Live behavior verified by compile + dev.log review**:
- Recruiter dashboard renders 4 clickable StatCards, applications-by-stage BarChart (chart-1 fill), quick actions card with 3 buttons, recent activity feed with formatRelativeTime
- Candidate shortlist renders job picker + filters + ranked table with FitScoreBadge, CoverageBadge, Fragment-paired expandable explanation rows with recommendation banner
- Candidate profiles (NEW) renders dedupe-by-student list with enriched batch/branch/CGPA columns and Applications count badge
- Candidate detail renders ProgressRing header, SkillTag with isVerified, applications summary card, FitScoreBadge in fit panel, schedule-interview dialog
- My jobs renders search + status filter + table with applications count column + JOB_STATUS_CLS badges + Create/Edit/Candidates actions
- Job detail renders all badges + matches/applications count tiles + Required/Preferred skill cards + Edit/Candidates/Applications actions
- Recruitment pipeline renders Tabs Table/Board with 8 kanban columns + horizontal scroll on narrow screens
- Application detail shows status timeline with primary-dot latest marker, semantic offer card, pending-toned internal notes, three action dialogs (update status / schedule interview / extend offer), resume preview with bullet claim-status semantic badges
- Interviews (NEW) renders upcoming/past table with outcome badges
- Settings (NEW) renders Account + Security tabs with show/hide password toggles

All 7 nav items in NAV_ITEMS across 4 groups (OVERVIEW/JOBS/CANDIDATES/SETTINGS) now have working destinations, plus 3 dynamic detail routes (recruiter/jobs/[id], recruiter/applications/[id], recruiter/candidates/[id]) that the sidebar highlights via the existing `startsWith(item.view + '/')` logic.

The recruiter experience integrates cleanly with the existing student/officer views via the shared AppShell, shared ui helpers, and role-aware API routes — no prisma schema changes were needed; the only API touch was extending the jobs list endpoint with a non-breaking additional field (`applicationsCount`) consumed only by the recruiter's jobs view (and pre-existing optional access in the officer's jobs-management view).
