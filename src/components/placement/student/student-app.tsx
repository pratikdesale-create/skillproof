'use client'

import { useAppStore } from '@/store/app-store'
import { AppShell, type NavItem } from '@/components/placement/shared/app-shell'
import {
  LayoutDashboard, User, ShieldCheck, Briefcase, Target, FileText, ListChecks,
} from 'lucide-react'
import { Dashboard } from './dashboard'
import { Profile } from './profile'
import { SkillsEvidence } from './skills-evidence'
import { Jobs } from './jobs'
import { JobDetail } from './job-detail'
import { Matches } from './matches'
import { Resumes } from './resumes'
import { ResumeDetail } from './resume-detail'
import { Applications } from './applications'
import { ApplicationDetail } from './application-detail'

const NAV_ITEMS: NavItem[] = [
  { view: 'student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'student/profile', label: 'Profile', icon: User },
  { view: 'student/skills', label: 'Skills & Evidence', icon: ShieldCheck },
  { view: 'student/jobs', label: 'Discover Jobs', icon: Briefcase },
  { view: 'student/matches', label: 'My Fit Scores', icon: Target },
  { view: 'student/resumes', label: 'Resume Builder', icon: FileText },
  { view: 'student/applications', label: 'Applications', icon: ListChecks },
]

// Extract the trailing id from a view path like 'student/jobs/abc123' -> 'abc123'.
function getId(view: string, prefix: string): string | null {
  if (!view.startsWith(prefix + '/')) return null
  const rest = view.slice(prefix.length + 1)
  if (!rest || rest.includes('/')) return null
  return decodeURIComponent(rest)
}

export function StudentApp() {
  const route = useAppStore(s => s.route)
  return (
    <AppShell navItems={NAV_ITEMS}>
      <StudentRouter view={route.view} idFromParams={route.params?.id} />
    </AppShell>
  )
}

function StudentRouter({
  view,
  idFromParams,
}: {
  view: string
  idFromParams?: string
}) {
  if (view === 'student/dashboard') return <Dashboard />
  if (view === 'student/profile') return <Profile />
  if (view === 'student/skills') return <SkillsEvidence />
  if (view === 'student/jobs') return <Jobs />
  if (view === 'student/matches') return <Matches />
  if (view === 'student/resumes') return <Resumes />
  if (view === 'student/applications') return <Applications />

  // Detail views — id may be supplied in params.id or trailing path segment
  const jobId = idFromParams ?? getId(view, 'student/jobs') ?? null
  if (jobId) return <JobDetail id={jobId} />

  const resumeId = idFromParams ?? getId(view, 'student/resumes') ?? null
  if (resumeId) return <ResumeDetail id={resumeId} />

  const appId = idFromParams ?? getId(view, 'student/applications') ?? null
  if (appId) return <ApplicationDetail id={appId} />

  // Default fallback
  return <Dashboard />
}
