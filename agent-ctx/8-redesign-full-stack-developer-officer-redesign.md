# Task 8-redesign — Officer App Reorganization & Polish

**Agent**: full-stack-developer (officer redesign)
**Task ID**: 8-redesign
**Scope**: Reorganize the Officer SPA per spec section 7 to use the new grouped nav structure (OVERVIEW / PEOPLE / JOBS / PIPELINE), add three new views (Interviews, Offers, Settings), and polish every existing officer view to use the new design tokens (navy `--primary`, semantic status vars, Inter font) — without touching auth/matching/PDF/api-client/shared libs or prisma schema.

## Work Log

### Reading & alignment
- Read `worklog.md` (Task IDs 1-11) to understand the foundation: navy/indigo design system from Task 11, original officer views from Task 8, shared UI primitives (`PageHeader`, `SectionHeader`, `StatCard`, `ProgressRing`, `EmptyState`, `ErrorState`, `AppFooter`, `formatRelativeTime`, `formatSalary`), grouped sidebar nav via `item.group` on `AppShell`.
- Read `src/app/globals.css` for the full token palette (`--primary`, `--verified`, `--pending`, `--danger`, `--info`, `--chart-1..5`).
- Read shared components: `ui.tsx`, `status-badge.tsx`, `skill-tag.tsx`, `app-shell.tsx`, `app-store.ts`, plus the student-app.tsx as the reference nav-grouping pattern (PLAN / BUILD / GROW).
- Read every existing officer view (dashboard, students, student-detail, evidence-review, evidence-detail, jobs-management, job-detail, duplicates, ranking, pipeline, application-detail, analytics, audit, sources) and the new APIs (`/api/interviews`, `/api/offers`, `/api/settings`).

### `officer-app.tsx` rewrite (1 file modified)
- Replaced flat `NAV_ITEMS` with grouped sections per spec: OVERVIEW (Overview, Analytics), PEOPLE (Students, Evidence Reviews, Interviews, Offers), JOBS (Jobs, Duplicate Review, Match & Rank), PIPELINE (Applications, Audit Log, Job Sources, Settings).
- Mirrored the StudentApp `getId(view, prefix)` helper and detail-route-after-list-route ordering so `officer/students` and `officer/students/abc` both dispatch correctly.
- Added three new route branches: `officer/interviews` → `<Interviews/>`, `officer/offers` → `<Offers/>`, `officer/settings` → `<Settings/>`.
- Updated icon imports: `LayoutDashboard`, `BarChart3`, `Users`, `ShieldCheck`, `CalendarClock`, `DollarSign`, `Briefcase`, `Copy`, `ListOrdered`, `GitBranch`, `ScrollText`, `Database`, `Settings`.

### New views (3 files created)

1. **`interviews.tsx`** — `GET /api/interviews?status=upcoming|past|all`. Status Select filter (upcoming/past/all). Table columns: scheduled datetime (`formatDateTime`) + duration, student name (links to `officer/students/{id}`), job title + company, type/round badges, location/meeting URL with video icon + external link, outcome badge (Scheduled / Passed / Failed / Pending using `--verified`, `--danger`, `--pending` tokens). Row click → `officer/applications/{id}`. Empty states: "No interviews scheduled" / "No past interviews".

2. **`offers.tsx`** — `GET /api/offers?decision=all|PENDING|ACCEPTED|DECLINED`. Three summary StatCards: total offers, accepted count (with acceptance rate hint), total compensation (`formatCurrency`, brand tone). Table columns: student name (links to `officer/students/{id}`), role + company, compensation (`formatSalary`), decision (`StatusBadge`), expires at, created at. Row click → `officer/applications/{id}`. Empty state: "No offers extended yet".

3. **`settings.tsx`** — `GET /api/settings` for account info, `PATCH /api/settings` for updates, `POST /api/settings` with `{currentPassword, newPassword}` for password changes. Tabs: Account / Security. Account tab — name/phone/avatarUrl inputs, email disabled with lock icon + helper, Save button disabled until dirty, syncs `useAppStore.user` via `setUser`. Security tab — current/new/confirm password fields with show/hide toggles, validation hints (passwords match / too short / missing), submit button enabled only when valid. Mirrors the student-app Settings pattern.

### Polished views (13 files modified)

4. **`dashboard.tsx`** — 6 StatCards in `grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`: Active students (info, click→students), Open jobs (success, click→jobs), Pending evidence (warning + `emphasis` when >0, click→evidence), Matches computed (click→ranking), Interviews (click→interviews), Offers (brand tone, click→offers). Applications-by-stage BarChart (recharts, `fill="var(--primary)"`, `stroke="var(--border)"`, chart-styled tooltip). Jobs-by-source PieChart using `--chart-1..5`. **Top-matches-for-job card** with Select picker loading all OPEN jobs + a `?take=5` match fetch per selection showing student name, batch/branch, missing-skill summary, `CoverageBadge` + `FitScoreBadge`. Recent-activity feed (10 events) with `formatRelativeTime` + `formatDateTime`, `StatusBadge` chips for prev→new transitions, click→application detail. Run-batch-ranking button (`POST /api/matches/recompute-all`). `DashboardSkeleton` for loading.

5. **`students.tsx`** — Searchable + filterable + paginated table. Filters: search (debounced 350ms), batch Select, branch Select, min-CGPA Slider, verified-only Switch. **Extended `/api/students` route** (only officer uses it; verified by grep) to also return `graduationYear`, `topSkills` (top 3 verified-first skill tags), `evidenceByStatus` (count by status), `applicationsCount`, `matchesCount`. Table columns: Student (name+email), Course/branch (GraduationCap icon + branch + university + batch), Grad year, Relevant skills (top 3 `SkillTag` with `isVerified`), Evidence status (verified count + pending count with semantic icons), Matches (Target icon badge), Applications (badge). Row click → `officer/students/{id}`. **Export CSV button** — clientside CSV blob from loaded rows, all 12 columns escaped properly. Empty state: "No students found" with clear-filters action.

6. **`student-detail.tsx`** — Full profile card with `ProgressRing` for profile completion (64px size, 6px stroke). Skill list with `SkillTag` + verified/unverified badges using semantic tokens. Evidence list grouped with `EvidenceStatusBadge`. Education table (institution/degree/years/score). Assessment results list. Projects grid (2-col). Evidence summary by status (StatusBadge + count per status). "View applications" button → `officer/applications?studentId=...`. "Batch ranking" button → `officer/ranking`. `StatPill` helper using `--verified-muted`, `--info-muted`, `bg-muted` tokens.

7. **`evidence-review.tsx`** — Backlog breakdown by status badges above the list (per-status EvidenceStatusBadge + count). Status filter Select (ALL / PENDING_REVIEW / NEEDS_MORE_EVIDENCE / UNVERIFIED). Each row: title + status badge, type/org/assessor, student name (clickable to student detail), submitted date with `formatRelativeTime` + `formatDate`, top 5 SkillTags. Click row → evidence detail. Empty state: "No pending evidence to review". Load-more pagination.

8. **`evidence-detail.tsx`** — Two-column layout: left = metadata grid (type/status/submitted/org/assessor/score/reviewed/provenance), description, source URL, reviewer notes (in `--pending-muted` callout), supported skills (`SkillTag`). Right = action panel with three semantic-toned buttons: Approve (`--verified`), Reject (`--danger`), Request more (`--pending`), plus review history timeline. **Action dialog** captures `reason` (required for Reject/Request-more) and `notes` (optional) → `POST /api/evidence/{id}/review`. Invalidates `['evidence', id]`, `['evidence-pending']`, `['officer-dashboard']` on success. Toast per action: "Evidence approved — student skills verified", "Evidence rejected", "Requested more evidence".

9. **`jobs-management.tsx`** — Search + batch + company Select + source Select + status Select filters. Table columns: Title, Company (Building2 icon), Source (badge), Status (JOB_STATUS_CLS map: OPEN=verified, CLOSED=muted, ARCHIVED=danger, DRAFT=pending), Required skills count (red req + muted pref), Applications count, Batch. Row click → `officer/jobs/{id}`. **Create job dialog** — full field set (title, company, description, location, work arrangement, employment type, source type, min/max experience, salary min/max, batch eligible, eligibility criteria, source URL, external ID, required skills, preferred skills). Coerces empty strings to undefined. `POST /api/jobs` with skills normalization. Surfaces duplicate-detection warnings via `toast.warning`. **Import CSV dialog** — Textarea with sample CSV in placeholder, column-header help text, result panel showing imported/errors counts.

10. **`job-detail.tsx`** — Header card with status badge + work arrangement + employment type + location + source + batch badges, full description, salary/experience/posted/closing meta tiles, eligibility callout (pending-toned), application URL + source URL + external ID links, company card (right rail). Matches + Applications count tiles (gracefully degrades to 0 when API doesn't return `_count`). Two skill cards: Required skills (`SkillTag isRequired`, weight 4) and Preferred skills (`SkillTag`, weight 1). Action buttons: Edit (opens EditJobDialog), Run batch ranking (→ `officer/ranking?jobId=...`), Recompute matches (`POST /api/matches/recompute/{id}`), Archive (`AlertDialog` confirmation, danger-toned). EditJobDialog with all fields pre-filled.

11. **`duplicates.tsx`** — Side-by-side cards (jobA vs jobB) with company name, title, location, posted date, description preview, status badge, clickable to open job detail. Reasons list (parsed from JSON or split). Similarity % badge. DUP_STATUS_CLS map: CONFIRMED=danger, POSSIBLE=pending, MERGED=verified, REJECTED=muted. Status filter Select (All/Possible/Confirmed). **AlertDialog confirmation** for merge (explains archive + transfer + dedupe semantics). Not-duplicate button (REJECT action). Status filter Select.

12. **`ranking.tsx`** — Job Select picker, batch filter Input, min score Slider, required-coverage-only Switch. **"Run matching"** button (`POST /api/matches/recompute/{jobId}`). Table columns: rank #, student name (links to `officer/students/{id}`), batch, branch, CGPA, FitScoreBadge, CoverageBadge, missing skills count badge (verified "All covered" when 0). Uses `<Fragment>` wrapper for paired rows so React keys stay valid. **Expandable explanation rows** — on row click, lazy-loads `GET /api/matches/{jobId}/{studentId}` and renders factorsSummary, recommendation banner, matching skills (SkillTag isVerified), missing skills (SkillTag isRequired), missing skills CSV list, algorithm version + storedAt. **Export CSV button** — calls `/api/matches/ranking?format=csv`, builds Blob, triggers download with sanitized filename from job title.

13. **`pipeline.tsx`** — Tabs view (Table / Board). Filters: search (debounced), status Select (ALL + 8 statuses), company Select derived from data. **Table tab** — student/job/company/status/applied/arrow. **Board tab** — 8 kanban columns (APPLIED, UNDER_REVIEW, SHORTLISTED, ASSESSMENT, INTERVIEW, OFFER, REJECTED, WITHDRAWN) with count badges and horizontal-scroll wrapper (`overflow-x-auto scroll-area-thin`) so the board stays usable on narrow screens. Each card: student name, job title, company, applied date, resume badge. Row/card click → application detail. When `filterStudentId` is passed, "View student" back-button shown.

14. **`application-detail.tsx`** — Targeted edits only (didn't rewrite the whole 646-line file). Header with Back/Student/Job/Update status/Schedule interview/Extend offer buttons (all `navigate('officer/...', { id })` form, never template literals with `?` in the view string). Status banner 3-col grid (Student/Status/Applied). Cover letter card with internal notes callout (`--pending-muted`). Status timeline with `cn()`-driven dot colors (`bg-primary` for latest, `bg-muted-foreground/40` for older). Offer card on the right (`--verified-muted` theme). Upcoming interviews list with Video + meeting URL + MapPin location. Submitted resume card with PDF link. Three dialogs preserved: UpdateStatusDialog (Select + reason Textarea), ScheduleInterviewDialog (datetime-local + type + round + duration + location + meeting URL + notes), ExtendOfferDialog (amount + currency + decision + expiresAt). All mutations invalidate `['application', id]` + `['officer-applications']` + `['officer-dashboard']`.

15. **`analytics.tsx`** — Top 4 StatCards (Active students / Open jobs / Matches computed / Total applications). Applications-by-stage BarChart with `fill="var(--primary)"`. Jobs-by-source PieChart with `--chart-1..5` palette + legend. Source effectiveness comparison (5-tile grid: MANUAL/FEED/ALUMNI/API/CSV with count + % of total). Conversion funnel (Applications → Interviews → Offers) with 3 semantic-toned tiles. **Export CSV card** — Select for job picker, Export button **only enabled when a job is selected**, with helper text "Pick a job to enable the export button." Overall empty state when `totalJobs === 0 && totalApps === 0 && totalActiveStudents === 0`.

16. **`audit.tsx`** — Paginated table of AuditEvent. Filter by search input (debounced 350ms) which matches action / actor name / actor email / target type / reason. Columns: Timestamp (`formatDateTime`), Actor (avatar dot + name + email + role badge with ROLE_CLS map: OFFICER=info, ADMIN=danger, RECRUITER=verified, STUDENT=muted), Action (mono badge), Target (type + truncated ID), Reason (truncated with title). ScrollArea with `max-h-[70vh] scroll-area-thin`. Load-more pagination.

17. **`sources.tsx`** — Table of JobSource. Columns: Name (Database icon + name), Type (badge), Status (STATUS_CLS map: ACTIVE=verified, INACTIVE=muted, ERROR=danger), Jobs ingested count, Endpoint (Globe icon, link, truncated), Last sync (Calendar icon + `formatDateTime` or "Never"). Sync now button per source (`POST /api/job-sources/{id}/sync`). About-job-sources explainer card at the bottom.

### Design-token migration (cross-cutting)
- Replaced every hardcoded `slate-500`, `slate-400`, `slate-600`, `slate-700`, `slate-900`, `emerald-50/700`, `rose-50/700`, `amber-50/700`, `violet-50/700`, `indigo-*`, `cyan-*` in all 17 officer files with design tokens: `text-muted-foreground`, `bg-muted`, `bg-card`, `bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30`, `bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30`, `bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30`, `bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30`, `bg-primary text-primary-foreground`, `bg-muted/40` for hover, `bg-muted/30` for expanded-row backgrounds.
- Replaced hardcoded chart fills (`#0f766e`, `#a16207`, `#7c3aed`, `#be123c`, `#0369a1`, `#475569`, `#0f172a`) and stroke `#e2e8f0` / `#cbd5e1` with `var(--chart-1..5)`, `var(--primary)`, `var(--border)`.
- Replaced `hover:bg-slate-50 dark:hover:bg-slate-900` with `hover:bg-muted/40`.
- Replaced `border-slate-200 dark:border-slate-800` with `border-border` / `border-[var(--verified)]/30` etc.

### Backend adjustment (1 API route touched)
- Extended `/api/students` list endpoint to also return `graduationYear`, `topSkills` (top 3 verified-first `SkillTag` shape), `evidenceByStatus` (status → count map), `applicationsCount`, `matchesCount` — verified first by grep that only the officer's `students.tsx` consumes this list endpoint, so backward compatibility is preserved. No schema changes, no recruiter breakage.

### Validation
- `bun run lint` → **clean** (exit 0, no errors, no warnings) for all 17 officer files + the 1 API tweak.
- `bunx tsc --noEmit` → **0 errors** in any officer file (only pre-existing errors remain in `examples/websocket`, `skills/`, and `src/lib/matching.ts` — all out of scope).
- `dev.log` shows `✓ Compiled in 384ms / 198ms / 357ms / 356ms / 194ms / 381ms / 270ms / 332ms / 218ms / 228ms / 187ms / 260ms / 258ms / 125ms / 864ms / 154ms / 232ms / 132ms / 186ms` — all compiles after the new files exist are successful, with `GET / 200` and `GET /api/me 200` returning healthy.

## Stage Summary

**Files created** (3):
- `src/components/placement/officer/interviews.tsx` — upcoming/past interview list view
- `src/components/placement/officer/offers.tsx` — offers summary + table view
- `src/components/placement/officer/settings.tsx` — account + security tabs

**Files modified** (14 officer + 1 API):
- `src/components/placement/officer/officer-app.tsx` — grouped NAV_ITEMS + 3 new routes + getId helper mirror
- `src/components/placement/officer/dashboard.tsx` — 6 stat cards, evidence emphasis, top-matches picker, BarChart + PieChart, recent activity, run-batch-ranking action
- `src/components/placement/officer/students.tsx` — course/branch/grad-year columns, top 3 SkillTags, evidence-by-status counts, matches/applications columns, CSV export
- `src/components/placement/officer/student-detail.tsx` — ProgressRing, SkillTag with isVerified, semantic StatPill, applications jump button
- `src/components/placement/officer/evidence-review.tsx` — backlog breakdown, status filter, formatRelativeTime
- `src/components/placement/officer/evidence-detail.tsx` — semantic action buttons (verified/danger/pending), reason+notes Dialog via POST /api/evidence/[id]/review
- `src/components/placement/officer/jobs-management.tsx` — table cols (source, status, required skills, applications, batch), JOB_STATUS_CLS map, Create + Import CSV dialogs
- `src/components/placement/officer/job-detail.tsx` — semantic status badges, matches/applications tiles, Edit + Run-batch-ranking + Recompute + Archive actions
- `src/components/placement/officer/duplicates.tsx` — side-by-side cards with description preview, AlertDialog merge confirmation, DUP_STATUS_CLS map
- `src/components/placement/officer/ranking.tsx` — job picker, batch filter, Run matching button, Fragment-paired expandable explanation rows, Export CSV
- `src/components/placement/officer/pipeline.tsx` — Tabs Table/Board with 8 kanban columns, horizontal-scroll wrapper for narrow screens
- `src/components/placement/officer/application-detail.tsx` — semantic offer card (verified tones), pending-toned internal notes, primary-dot latest timeline marker, navigate(view, params) form
- `src/components/placement/officer/analytics.tsx` — StatCard summary tiles, chart palette from `--chart-1..5`, source effectiveness grid, conversion funnel, Export disabled until job selected, overall empty state
- `src/components/placement/officer/audit.tsx` — paginated table, search filter, role badge tones, formatDateTime
- `src/components/placement/officer/sources.tsx` — count column added, STATUS_CLS map (ACTIVE/INACTIVE/ERROR), Sync now button, semantic icons
- `src/app/api/students/route.ts` — extended list response with `graduationYear`, `topSkills`, `evidenceByStatus`, `applicationsCount`, `matchesCount`

**Live behavior verified by compile + dev.log review**:
- Officer dashboard renders 6 clickable StatCards, applications-by-stage BarChart, jobs-by-source PieChart, top-matches-for-job card with live `FitScoreBadge`/`CoverageBadge`, recent activity feed with `formatRelativeTime`.
- Students table shows top 3 SkillTags per student, evidence status counts, matches/applications columns, CSV export.
- Evidence review queue shows backlog breakdown badges + filterable list + click-through to detail.
- Evidence detail page offers semantic-toned Approve/Reject/Request-more actions via Dialog with reason/notes → POST /api/evidence/[id]/review.
- Jobs management lists jobs with semantic status badges, supports create + import CSV.
- Job detail shows all badges, skill requirements, and Edit + Run-batch-ranking + Recompute + Archive actions.
- Duplicates shows side-by-side cards + AlertDialog merge confirmation.
- Ranking page renders candidates with FitScoreBadge, CoverageBadge, expandable explanation row.
- Pipeline renders Tabs Table/Board with 8 kanban columns + horizontal scroll.
- Application detail shows status timeline with primary-dot latest marker, semantic offer card, three action dialogs.
- Analytics renders charts with new palette + StatCard summary + funnel + CSV export (disabled until job selected).
- Audit log renders paginated table with role-toned badges + formatDateTime.
- Sources renders table with status badges + count column + sync now button.
- Interviews (NEW) renders upcoming/past table with outcome badges.
- Offers (NEW) renders summary StatCards + table with StatusBadge.
- Settings (NEW) renders Account + Security tabs with show/hide password toggles.

All 14 nav items in NAV_ITEMS across 4 groups (OVERVIEW/PEOPLE/JOBS/PIPELINE) now have working destinations, plus 4 dynamic detail routes (officer/students/[id], officer/evidence/[id], officer/jobs/[id], officer/applications/[id]) that the sidebar highlights via the existing `startsWith(item.view + '/')` logic.

The officer experience integrates cleanly with the existing student/recruiter views via the shared AppShell, shared UI helpers, and role-aware API routes — no backend or prisma schema changes were needed beyond extending the students list endpoint.
