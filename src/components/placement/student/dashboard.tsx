'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, StatCard, CardSkeleton, EmptyState, ErrorState, formatDateTime } from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge, StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Briefcase, Users, Target, TrendingUp, Calendar, Clock, ArrowRight,
  ShieldCheck, FileText, Sparkles, AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Local types matching the actual API response shape
interface RecentMatch {
  jobId: string
  jobTitle: string
  company: { id: string; name: string; industry?: string | null }
  fitScore: number
  requiredCoverage: number
}

interface UpcomingInterview {
  id: string
  scheduledAt: string
  duration?: number | null
  location?: string | null
  meetingUrl?: string | null
  type: string
  round: number
  applicationId: string
  job: { id: string; title: string; company: { id: string; name: string } }
}

interface RecentAppUpdate {
  id: string
  applicationId: string
  previousStatus?: string | null
  newStatus: string
  reason?: string | null
  timestamp: string
  actor?: { id: string; name: string } | null
  job?: { id: string; title: string } | null
}

interface MissingSkillItem {
  name: string
  isRequired: boolean
}

interface MissingSkillsForTopMatch {
  jobId: string
  jobTitle: string
  skills: MissingSkillItem[]
}

interface DashboardData {
  profileCompletion: number
  supportedSkillsCount: number
  unverifiedSkillsCount: number
  skillsCount?: number
  evidenceCount?: number
  suitableJobsCount: number
  avgFitScore: number
  activeApplicationsCount: number
  recentMatches: RecentMatch[]
  upcomingInterviews: UpcomingInterview[]
  recentApplicationUpdates: RecentAppUpdate[]
  missingSkillsForTopMatch: MissingSkillsForTopMatch | null
}

export function Dashboard() {
  const navigate = useAppStore(s => s.navigate)
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['student-dashboard'],
    queryFn: () => apiGet<DashboardData>('/api/dashboard/student'),
    staleTime: 30_000,
  })

  if (isLoading) return <DashboardSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load dashboard'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your placement readiness at a glance"
      >
        <Button size="sm" onClick={() => navigate('student/jobs')}>
          <Briefcase className="size-4 mr-2" /> Browse jobs
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Profile complete"
          value={`${data.profileCompletion}%`}
          hint={data.profileCompletion < 80 ? 'Finish your profile to boost fit scores' : 'Looking good'}
          icon={Users}
          tone={data.profileCompletion >= 80 ? 'success' : 'warning'}
        />
        <StatCard
          label="Verified skills"
          value={data.supportedSkillsCount}
          hint={`${data.unverifiedSkillsCount} unverified`}
          icon={ShieldCheck}
          tone={data.unverifiedSkillsCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Suitable jobs"
          value={data.suitableJobsCount}
          hint="Open jobs you match"
          icon={Target}
          tone="info"
        />
        <StatCard
          label="Avg fit score"
          value={`${data.avgFitScore.toFixed(1)}%`}
          hint="Across all matches"
          icon={TrendingUp}
          tone={data.avgFitScore >= 50 ? 'success' : 'default'}
        />
      </div>

      {/* Active applications + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Active applications
            </CardTitle>
            <CardDescription className="text-3xl font-bold tabular-nums text-foreground">
              {data.activeApplicationsCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500 mb-4">Currently in interview pipeline</p>
            <Button variant="outline" size="sm" className="w-full" onClick={() => navigate('student/applications')}>
              Track applications <ArrowRight className="size-3 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4" /> Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" onClick={() => navigate('student/jobs')} className="justify-start h-auto py-3 flex-col items-start">
              <Briefcase className="size-4 mb-1" />
              <span className="text-sm font-medium">Browse jobs</span>
              <span className="text-xs text-slate-500">Discover open roles</span>
            </Button>
            <Button variant="outline" onClick={() => navigate('student/profile')} className="justify-start h-auto py-3 flex-col items-start">
              <Users className="size-4 mb-1" />
              <span className="text-sm font-medium">Update profile</span>
              <span className="text-xs text-slate-500">Edit bio, contact info</span>
            </Button>
            <Button variant="outline" onClick={() => navigate('student/resumes')} className="justify-start h-auto py-3 flex-col items-start">
              <FileText className="size-4 mb-1" />
              <span className="text-sm font-medium">Build resume</span>
              <span className="text-xs text-slate-500">Auto-generate with evidence</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent matches */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4" /> Top job matches
            </CardTitle>
            <CardDescription>Best-fit roles for your verified skills</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentMatches.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No matches yet"
                description="Add skills and evidence to see job matches"
                action={<Button size="sm" onClick={() => navigate('student/skills')}>Add skills</Button>}
              />
            ) : (
              <ScrollArea className="max-h-96">
                <ul className="divide-y">
                  {data.recentMatches.map((m, i) => (
                    <li
                      key={`${m.jobId}-${i}`}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      onClick={() => navigate(`student/jobs/${m.jobId}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">{m.jobTitle}</div>
                          <div className="text-xs text-slate-500 truncate">{m.company.name}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <CoverageBadge value={m.requiredCoverage} />
                          <FitScoreBadge score={m.fitScore} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Upcoming interviews */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="size-4" /> Upcoming interviews
            </CardTitle>
            <CardDescription>Next 3 scheduled</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.upcomingInterviews.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No interviews scheduled"
                description="Apply to roles to start interviewing"
              />
            ) : (
              <ScrollArea className="max-h-96">
                <ul className="divide-y">
                  {data.upcomingInterviews.map((iv) => (
                    <li
                      key={iv.id}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      onClick={() => navigate(`student/applications/${iv.applicationId}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">{iv.job.title}</div>
                          <div className="text-xs text-slate-500 truncate">{iv.job.company.name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDateTime(iv.scheduledAt)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className="text-xs">Round {iv.round}</Badge>
                          <Badge variant="secondary" className="text-xs">{iv.type}</Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent application updates */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" /> Recent application updates
            </CardTitle>
            <CardDescription>Last 5 status changes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentApplicationUpdates.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No updates yet"
                description="Apply to jobs to see updates here"
              />
            ) : (
              <ScrollArea className="max-h-96">
                <ul className="divide-y">
                  {data.recentApplicationUpdates.map((e) => (
                    <li key={e.id} className="p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">
                            {e.job?.title ?? 'Application'}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">
                            {e.actor?.name ?? 'System'}
                            {e.reason ? ` · ${e.reason}` : ''}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {formatDateTime(e.timestamp)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {e.previousStatus && (
                            <StatusBadge status={e.previousStatus} />
                          )}
                          <ArrowRight className="size-3 text-slate-400" />
                          <StatusBadge status={e.newStatus} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Missing skills for top match */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4" /> Skill gap for top match
            </CardTitle>
            <CardDescription>
              {data.missingSkillsForTopMatch
                ? `Required for ${data.missingSkillsForTopMatch.jobTitle}`
                : 'No active matches'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!data.missingSkillsForTopMatch ? (
              <EmptyState
                icon={AlertTriangle}
                title="No top match yet"
                description="Once you have matches, we'll show skill gaps here"
              />
            ) : data.missingSkillsForTopMatch.skills.length === 0 ? (
              <div className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md p-4">
                <ShieldCheck className="size-5 inline mr-2" />
                You meet all required skills for this role!
              </div>
            ) : (
              <ul className="space-y-2">
                {data.missingSkillsForTopMatch.skills.map((s, i) => (
                  <li
                    key={`${s.name}-${i}`}
                    className={cn(
                      'flex items-center justify-between gap-2 text-sm rounded-md border px-3 py-2',
                      s.isRequired
                        ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900'
                        : 'border-slate-200 bg-slate-50 dark:bg-slate-900'
                    )}
                  >
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="outline" className={cn(
                      'text-xs',
                      s.isRequired
                        ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300'
                    )}>
                      {s.isRequired ? 'Required' : 'Preferred'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your placement readiness at a glance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardContent className="p-6">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-3 w-40 mb-4" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <Skeleton className="h-4 w-32 mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-6 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</CardContent></Card>
        <Card><CardContent className="p-6 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</CardContent></Card>
      </div>
    </div>
  )
}
