'use client'

import { useAppStore } from '@/store/app-store'
import { AppShell, type NavItem } from '@/components/placement/shared/app-shell'
import {
  LayoutDashboard, Briefcase, Users, GitBranch,
} from 'lucide-react'
import { Dashboard } from './dashboard'
import { Jobs } from './jobs'
import { JobDetail } from './job-detail'
import { Shortlist } from './shortlist'
import { CandidateDetail } from './candidate-detail'
import { Pipeline } from './pipeline'
import { ApplicationDetail } from './application-detail'

const NAV_ITEMS: NavItem[] = [
  { view: 'recruiter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'recruiter/jobs', label: 'Company Jobs', icon: Briefcase },
  { view: 'recruiter/shortlist', label: 'Candidate Shortlist', icon: Users },
  { view: 'recruiter/applications', label: 'Recruitment Pipeline', icon: GitBranch },
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
  if (view === 'recruiter/jobs') return <Jobs />
  if (view === 'recruiter/shortlist') return <Shortlist />
  if (view === 'recruiter/applications') return <Pipeline />

  // Detail views — id may be supplied in params.id or trailing path segment
  const jobId = params.id ?? getId(view, 'recruiter/jobs') ?? null
  if (jobId) return <JobDetail id={jobId} />

  const appId = params.id ?? getId(view, 'recruiter/applications') ?? null
  if (appId) return <ApplicationDetail id={appId} />

  const candidateId = params.id ?? getId(view, 'recruiter/candidates') ?? null
  if (candidateId) {
    return <CandidateDetail id={candidateId} jobId={params.jobId} />
  }

  // Default fallback
  return <Dashboard />
}
