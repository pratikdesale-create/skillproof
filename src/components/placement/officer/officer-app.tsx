'use client'

import { useAppStore } from '@/store/app-store'
import { AppShell, type NavItem } from '@/components/placement/shared/app-shell'
import {
  LayoutDashboard, Users, ShieldCheck, Briefcase, Copy, ListOrdered,
  GitBranch, BarChart3, ScrollText, Database,
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

const NAV_ITEMS: NavItem[] = [
  { view: 'officer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'officer/students', label: 'Students', icon: Users },
  { view: 'officer/evidence', label: 'Evidence Review', icon: ShieldCheck },
  { view: 'officer/jobs', label: 'Job Management', icon: Briefcase },
  { view: 'officer/duplicates', label: 'Duplicate Review', icon: Copy },
  { view: 'officer/ranking', label: 'Batch Ranking', icon: ListOrdered },
  { view: 'officer/applications', label: 'Application Pipeline', icon: GitBranch },
  { view: 'officer/analytics', label: 'Analytics', icon: BarChart3 },
  { view: 'officer/audit', label: 'Audit Log', icon: ScrollText },
  { view: 'officer/sources', label: 'Job Sources', icon: Database },
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
  // Detail views (check before list views to disambiguate paths)
  const studentId = params.studentId ?? params.id ?? getId(view, 'officer/students')
  if (studentId && view !== 'officer/students') return <StudentDetail id={studentId} />

  const evidenceId = params.evidenceId ?? params.id ?? getId(view, 'officer/evidence')
  if (evidenceId && view !== 'officer/evidence') return <EvidenceDetail id={evidenceId} />

  const jobId = params.jobId ?? params.id ?? getId(view, 'officer/jobs')
  if (jobId && view !== 'officer/jobs') return <JobDetail id={jobId} />

  const applicationId = params.applicationId ?? params.id ?? getId(view, 'officer/applications')
  if (applicationId && view !== 'officer/applications') return <ApplicationDetail id={applicationId} />

  // List views
  if (view === 'officer/dashboard') return <Dashboard />
  if (view === 'officer/students') return <Students />
  if (view === 'officer/evidence') return <EvidenceReview />
  if (view === 'officer/jobs') return <JobsManagement />
  if (view === 'officer/duplicates') return <Duplicates />
  if (view === 'officer/ranking') return <Ranking initialJobId={params.jobId} />
  if (view === 'officer/applications') return <Pipeline filterStudentId={params.studentId} />
  if (view === 'officer/analytics') return <Analytics />
  if (view === 'officer/audit') return <Audit />
  if (view === 'officer/sources') return <Sources />

  // Default fallback
  return <Dashboard />
}
