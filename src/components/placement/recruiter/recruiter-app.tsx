'use client'

import { useAppStore } from '@/store/app-store'
import { AppShell, type NavItem } from '@/components/placement/shared/app-shell'
import {
  LayoutDashboard, Users, Briefcase, GitBranch, CalendarClock,
  Settings as SettingsIcon,
} from 'lucide-react'
import { Dashboard } from './dashboard'
import { Jobs } from './jobs'
import { JobDetail } from './job-detail'
import { Shortlist } from './shortlist'
import { CandidateDetail } from './candidate-detail'
import { Candidates } from './candidates'
import { Interviews } from './interviews'
import { Pipeline } from './pipeline'
import { ApplicationDetail } from './application-detail'
import { Settings } from './settings'

// Grouped sidebar navigation per spec section 8:
//   OVERVIEW   — Overview, Candidate Shortlists
//   JOBS       — My Jobs, Recruitment Pipeline
//   CANDIDATES — Candidate Profiles, Interviews
//   SETTINGS   — Settings
const NAV_ITEMS: NavItem[] = [
  // OVERVIEW
  { view: 'recruiter/dashboard', label: 'Overview', icon: LayoutDashboard, group: 'OVERVIEW' },
  { view: 'recruiter/shortlist', label: 'Candidate Shortlists', icon: Users, group: 'OVERVIEW' },
  // JOBS
  { view: 'recruiter/jobs', label: 'My Jobs', icon: Briefcase, group: 'JOBS' },
  { view: 'recruiter/applications', label: 'Recruitment Pipeline', icon: GitBranch, group: 'JOBS' },
  // CANDIDATES
  { view: 'recruiter/candidates', label: 'Candidate Profiles', icon: Users, group: 'CANDIDATES' },
  { view: 'recruiter/interviews', label: 'Interviews', icon: CalendarClock, group: 'CANDIDATES' },
  // SETTINGS
  { view: 'recruiter/settings', label: 'Settings', icon: SettingsIcon, group: 'SETTINGS' },
]

// Extract the trailing id from a view path like 'recruiter/jobs/abc123' -> 'abc123'.
function getId(view: string, prefix: string): string | null {
  if (!view.startsWith(prefix + '/')) return null
  const rest = view.slice(prefix.length + 1)
  if (!rest || rest.includes('/')) return null
  return decodeURIComponent(rest)
}

export function RecruiterApp() {
  const route = useAppStore(s => s.route)
  return (
    <AppShell navItems={NAV_ITEMS}>
      <RecruiterRouter
        view={route.view}
        params={route.params ?? {}}
      />
    </AppShell>
  )
}

function RecruiterRouter({
  view,
  params,
}: {
  view: string
  params: Record<string, string>
}) {
  // List views (must be checked before detail views)
  if (view === 'recruiter/dashboard') return <Dashboard />
  if (view === 'recruiter/shortlist') return <Shortlist />
  if (view === 'recruiter/jobs') return <Jobs />
  if (view === 'recruiter/applications') return <Pipeline filterJobId={params.jobId} />
  if (view === 'recruiter/candidates') return <Candidates />
  if (view === 'recruiter/interviews') return <Interviews />
  if (view === 'recruiter/settings') return <Settings />

  // Detail views — id may be supplied in params.id or trailing path segment.
  // Order matters: check list view prefixes first so 'recruiter/candidates' wins over
  // 'recruiter/candidates/abc'.
  const jobId = params.jobId ?? params.id ?? getId(view, 'recruiter/jobs')
  if (jobId && view !== 'recruiter/jobs') return <JobDetail id={jobId} />

  const applicationId = params.applicationId ?? params.id ?? getId(view, 'recruiter/applications')
  if (applicationId && view !== 'recruiter/applications') return <ApplicationDetail id={applicationId} />

  const candidateId = params.candidateId ?? params.id ?? getId(view, 'recruiter/candidates')
  if (candidateId && view !== 'recruiter/candidates') {
    return <CandidateDetail id={candidateId} jobId={params.jobId} />
  }

  // Default fallback
  return <Dashboard />
}
