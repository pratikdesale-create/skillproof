'use client'

import { useAppStore } from '@/store/app-store'
import { AppShell, type NavItem } from '@/components/placement/shared/app-shell'
import {
  LayoutDashboard, BarChart3, Users, ShieldCheck, CalendarClock,
  DollarSign, Briefcase, Copy, ListOrdered, GitBranch, ScrollText,
  Database, Settings as SettingsIcon,
} from 'lucide-react'
import { Dashboard } from './dashboard'
import { Students } from './students'
import { StudentDetail } from './student-detail'
import { EvidenceReview } from './evidence-review'
import { EvidenceDetail } from './evidence-detail'
import { JobsManagement } from './jobs-management'
import { JobDetail } from './job-detail'
import { Duplicates } from './duplicates'
import { Ranking } from './ranking'
import { Pipeline } from './pipeline'
import { ApplicationDetail } from './application-detail'
import { Analytics } from './analytics'
import { Audit } from './audit'
import { Sources } from './sources'
import { Interviews } from './interviews'
import { Offers } from './offers'
import { Settings } from './settings'

// Grouped sidebar navigation per spec section 7:
//   OVERVIEW — Dashboard, Analytics
//   PEOPLE   — Students, Evidence Reviews, Interviews, Offers
//   JOBS     — Jobs, Duplicate Review, Match & Rank
//   PIPELINE — Applications, Audit Log, Job Sources, Settings
const NAV_ITEMS: NavItem[] = [
  // OVERVIEW
  { view: 'officer/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'OVERVIEW' },
  { view: 'officer/analytics', label: 'Analytics', icon: BarChart3, group: 'OVERVIEW' },
  // PEOPLE
  { view: 'officer/students', label: 'Students', icon: Users, group: 'PEOPLE' },
  { view: 'officer/evidence', label: 'Evidence Reviews', icon: ShieldCheck, group: 'PEOPLE' },
  { view: 'officer/interviews', label: 'Interviews', icon: CalendarClock, group: 'PEOPLE' },
  { view: 'officer/offers', label: 'Offers', icon: DollarSign, group: 'PEOPLE' },
  // JOBS
  { view: 'officer/jobs', label: 'Jobs', icon: Briefcase, group: 'JOBS' },
  { view: 'officer/duplicates', label: 'Duplicate Review', icon: Copy, group: 'JOBS' },
  { view: 'officer/ranking', label: 'Match & Rank', icon: ListOrdered, group: 'JOBS' },
  // PIPELINE
  { view: 'officer/applications', label: 'Applications', icon: GitBranch, group: 'PIPELINE' },
  { view: 'officer/audit', label: 'Audit Log', icon: ScrollText, group: 'PIPELINE' },
  { view: 'officer/sources', label: 'Job Sources', icon: Database, group: 'PIPELINE' },
  { view: 'officer/settings', label: 'Settings', icon: SettingsIcon, group: 'PIPELINE' },
]

// Extract the trailing id from a view path like 'officer/students/abc123' -> 'abc123'.
function getId(view: string, prefix: string): string | null {
  if (!view.startsWith(prefix + '/')) return null
  const rest = view.slice(prefix.length + 1)
  if (!rest || rest.includes('/')) return null
  return decodeURIComponent(rest)
}

export function OfficerApp() {
  const route = useAppStore(s => s.route)
  return (
    <AppShell navItems={NAV_ITEMS}>
      <OfficerRouter view={route.view} params={route.params ?? {}} />
    </AppShell>
  )
}

function OfficerRouter({
  view,
  params,
}: {
  view: string
  params: Record<string, string>
}) {
  // List views are checked first so 'officer/students' and 'officer/students/abc'
  // both dispatch correctly.
  if (view === 'officer/dashboard') return <Dashboard />
  if (view === 'officer/analytics') return <Analytics />
  if (view === 'officer/students') return <Students />
  if (view === 'officer/evidence') return <EvidenceReview />
  if (view === 'officer/interviews') return <Interviews />
  if (view === 'officer/offers') return <Offers />
  if (view === 'officer/jobs') return <JobsManagement />
  if (view === 'officer/duplicates') return <Duplicates />
  if (view === 'officer/ranking') return <Ranking initialJobId={params.jobId} />
  if (view === 'officer/applications') return <Pipeline filterStudentId={params.studentId} />
  if (view === 'officer/audit') return <Audit />
  if (view === 'officer/sources') return <Sources />
  if (view === 'officer/settings') return <Settings />

  // Detail views — id may be supplied in params.<entity>Id or trailing path segment
  const studentId = params.studentId ?? params.id ?? getId(view, 'officer/students')
  if (studentId && view !== 'officer/students') return <StudentDetail id={studentId} />

  const evidenceId = params.evidenceId ?? params.id ?? getId(view, 'officer/evidence')
  if (evidenceId && view !== 'officer/evidence') return <EvidenceDetail id={evidenceId} />

  const jobId = params.jobId ?? params.id ?? getId(view, 'officer/jobs')
  if (jobId && view !== 'officer/jobs') return <JobDetail id={jobId} />

  const applicationId = params.applicationId ?? params.id ?? getId(view, 'officer/applications')
  if (applicationId && view !== 'officer/applications') return <ApplicationDetail id={applicationId} />

  // Default fallback
  return <Dashboard />
}
