'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, SectionHeader, StatCard, ProgressRing, CardSkeleton,
  EmptyState, ErrorState, formatDateTime,
} from '@/components/placement/shared/ui'
import {
  FitScoreBadge, CoverageBadge, StatusBadge,
} from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Briefcase, Target, TrendingUp, Calendar, Clock, ArrowRight, ArrowRightCircle,
  ShieldCheck, FileText, Sparkles, AlertTriangle, CheckCircle2, ListChecks,
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
  const user = useAppStore(s => s.user)
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

  const noActivity =
    (data.recentMatches?.length ?? 0) === 0 &&
    (data.activeApplicationsCount ?? 0) === 0 &&
    (data.supportedSkillsCount ?? 0) === 0

  // Compute the most useful next action prompt (deterministic, single line)
  let nextAction: { label: string; cta: string; view: string } = {
    label: 'Add skills and evidence to unlock your first fit scores',
    cta: 'Add a skill',
    view: 'student/skills',
  }
  if (data.profileCompletion < 80) {
    nextAction = {
      label: 'Finish your profile to improve fit scores',
      cta: 'Complete profile',
      view: 'student/settings',
    }
  } else if (data.unverifiedSkillsCount > 0) {
    nextAction = {
      label: `${data.unverifiedSkillsCount} skill${data.unverifiedSkillsCount === 1 ? '' : 's'} waiting for evidence`,
      cta: 'Submit evidence',
      view: 'student/skills',
    }
  } else if ((data.recentMatches?.length ?? 0) === 0) {
    nextAction = {
      label: 'Browse open roles to discover matching jobs',
      cta: 'Browse jobs',
      view: 'student/jobs',
    }
  } else if ((data.activeApplicationsCount ?? 0) === 0) {
    nextAction = {
      label: 'Apply to a matched role to start your placement pipeline',
      cta: 'View matches',
      view: 'student/jobs',
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] ?? 'Student'}`}
        description={nextAction.label}
      >
        <Button size="sm" onClick={() => navigate(nextAction.view)}>
          {nextAction.cta} <ArrowRight className="size-4 ml-1" />
        </Button>
      </PageHeader>

      {/* Onboarding empty state when truly new student */}
      {noActivity ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Sparkles}
              title="Let's get you placement-ready"
              description="Start by adding your skills, then back them with evidence. Once verified, you'll see live fit scores for open jobs and can apply in one click."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button size="sm" onClick={() => navigate('student/skills')}>
                    <ShieldCheck className="size-4 mr-1" /> Add skills
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate('student/settings')}>
                    Complete profile
                  </Button>
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Key metrics row — Profile readiness gets visual prominence */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Profile readiness — emphasized card with ProgressRing */}
        <Card className="md:col-span-1 lg:col-span-1 ring-1 ring-primary/20 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <ProgressRing value={data.profileCompletion} size={64} strokeWidth={6} label="ready" />
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider font-medium text-muted-foreground">
                Profile readiness
              </div>
              <div className="text-xl font-bold tabular-nums mt-0.5">
                {data.profileCompletion}%
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {data.profileCompletion >= 80 ? 'Strong — ready to apply' : 'Add details to boost fit scores'}
              </div>
            </div>
          </CardContent>
        </Card>

        <StatCard
          label="Supported skills"
          value={data.supportedSkillsCount}
          hint={data.unverifiedSkillsCount > 0 ? `${data.unverifiedSkillsCount} awaiting evidence` : 'All verified'}
          icon={ShieldCheck}
          tone={data.unverifiedSkillsCount > 0 ? 'warning' : 'success'}
          onClick={() => navigate('student/skills')}
        />
        <StatCard
          label="Suitable jobs"
          value={data.suitableJobsCount}
          hint="Open roles you match"
          icon={Target}
          tone="info"
          onClick={() => navigate('student/jobs')}
        />
        <StatCard
          label="Active applications"
          value={data.activeApplicationsCount}
          hint="Currently in pipeline"
          icon={ListChecks}
          tone={data.activeApplicationsCount > 0 ? 'success' : 'default'}
          onClick={() => navigate('student/applications')}
        />
      </div>

      {/* Profile readiness — recommended next actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4" /> Recommended next actions
          </CardTitle>
          <CardDescription>Concrete steps to improve your placement readiness</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NextAction
              done={data.profileCompletion >= 80}
              icon={FileText}
              title="Complete profile fields"
              hint="University, branch, CGPA, bio, links"
              view="student/settings"
              cta="Open settings"
            />
            <NextAction
              done={(data.unverifiedSkillsCount ?? 0) === 0 && (data.supportedSkillsCount ?? 0) > 0}
              icon={ShieldCheck}
              title="Submit evidence for unverified skills"
              hint={data.unverifiedSkillsCount > 0 ? `${data.unverifiedSkillsCount} pending` : 'All skills backed by evidence'}
              view="student/skills"
              cta="Submit evidence"
            />
            <NextAction
              done={(data.recentMatches?.length ?? 0) > 0}
              icon={Target}
              title="Add skills to compute fit scores"
              hint={data.recentMatches.length > 0 ? `${data.recentMatches.length} matches ready` : 'No matches yet'}
              view="student/skills"
              cta="Manage skills"
            />
            <NextAction
              done={(data.activeApplicationsCount ?? 0) > 0}
              icon={Briefcase}
              title="Apply to a recommended role"
              hint={data.recentMatches.length > 0 ? `${data.recentMatches.length} matched jobs to explore` : 'Add skills first'}
              view="student/jobs"
              cta="Find jobs"
            />
          </ul>
        </CardContent>
      </Card>

      {/* Recommended opportunities — top 5 matches */}
      <div>
        <SectionHeader
          title="Recommended opportunities"
          description="Best-fit roles based on your verified skills"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('student/jobs')}>
              View all <ArrowRight className="size-3 ml-1" />
            </Button>
          }
        />
        {data.recentMatches.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={Target}
                title="No matches yet"
                description="Add verified skills and we'll compute fit scores for every open role."
                action={<Button size="sm" onClick={() => navigate('student/skills')}>Add skills</Button>}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.recentMatches.map((m, i) => (
              <RecommendedJobCard key={`${m.jobId}-${i}`} match={m} onView={() => navigate(`student/jobs/${m.jobId}`)} />
            ))}
          </div>
        )}
      </div>

      {/* Application progress + upcoming interviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="size-4" /> Application progress
            </CardTitle>
            <CardDescription>Last 5 status updates</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentApplicationUpdates.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No applications yet"
                description="Explore matching roles to start your placement journey."
                action={<Button size="sm" onClick={() => navigate('student/jobs')}>Browse jobs</Button>}
              />
            ) : (
              <ScrollArea className="max-h-96 scroll-area-thin">
                <ul className="divide-y">
                  {data.recentApplicationUpdates.map((e) => (
                    <li
                      key={e.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`student/applications/${e.applicationId}`)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{e.job?.title ?? 'Application'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {e.actor?.name ?? 'System'}{e.reason ? ` · ${e.reason}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground/80 mt-0.5">{formatDateTime(e.timestamp)}</div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {e.previousStatus && <StatusBadge status={e.previousStatus} size="sm" />}
                          {e.previousStatus && <ArrowRight className="size-3 text-muted-foreground" />}
                          <StatusBadge status={e.newStatus} size="sm" />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

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
              <ScrollArea className="max-h-96 scroll-area-thin">
                <ul className="divide-y">
                  {data.upcomingInterviews.map((iv) => (
                    <li
                      key={iv.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`student/applications/${iv.applicationId}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-sm">{iv.job.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{iv.job.company.name}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
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

      {/* Skill gap for top match (kept) */}
      {data.missingSkillsForTopMatch && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4" /> Skill gap for top match
            </CardTitle>
            <CardDescription>
              Required skills missing for {data.missingSkillsForTopMatch.jobTitle}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.missingSkillsForTopMatch.skills.length === 0 ? (
              <div className="text-sm text-[var(--verified-foreground)] bg-[var(--verified-muted)] border border-[var(--verified)]/30 rounded-md p-4">
                <ShieldCheck className="size-4 inline mr-2" />
                You meet all required skills for this role.
              </div>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {data.missingSkillsForTopMatch.skills.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <SkillTag name={s.name} isRequired={s.isRequired} />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(`student/jobs/${data.missingSkillsForTopMatch!.jobId}`)}>
                View job details <ArrowRight className="size-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function NextAction({
  done, icon: Icon, title, hint, view, cta,
}: {
  done: boolean
  icon: React.ComponentType<{ className?: string }>
  title: string
  hint: string
  view: string
  cta: string
}) {
  const navigate = useAppStore(s => s.navigate)
  return (
    <li
      className={cn(
        'rounded-md border p-3 flex items-start gap-3 transition-colors',
        done ? 'bg-[var(--verified-muted)] border-[var(--verified)]/30' : 'bg-card hover:bg-muted/50'
      )}
    >
      <div className={cn(
        'size-8 rounded-md flex items-center justify-center shrink-0',
        done ? 'bg-[var(--verified)]/20 text-[var(--verified-foreground)]' : 'bg-muted text-muted-foreground'
      )}>
        {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
      </div>
      {!done && (
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate(view)}>
          {cta} <ArrowRightCircle className="size-3 ml-1" />
        </Button>
      )}
    </li>
  )
}

function RecommendedJobCard({
  match, onView,
}: {
  match: RecentMatch
  onView: () => void
}) {
  const navigate = useAppStore(s => s.navigate)
  // Derive a short, deterministic relevance explanation from the fit score + coverage
  const fit = match.fitScore
  const expl = fit >= 75
    ? 'Strong match — you cover most required skills with verified evidence.'
    : fit >= 50
    ? 'Moderate match — a few required skills are still missing or unverified.'
    : fit >= 25
    ? 'Partial match — close the listed skill gaps to improve your score.'
    : 'Low match — focus on adding verified evidence for required skills.'
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight truncate">{match.jobTitle}</CardTitle>
            <CardDescription className="mt-0.5 truncate">
              {match.company.name}{match.company.industry ? ` · ${match.company.industry}` : ''}
            </CardDescription>
          </div>
          <FitScoreBadge score={fit} size="lg" className="shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Required coverage</span>
          <CoverageBadge value={match.requiredCoverage} />
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{expl}</p>
        <div className="mt-auto flex items-center gap-2 pt-2 border-t">
          <Button size="sm" className="flex-1" onClick={onView}>
            View details
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`student/jobs/${match.jobId}`)}>
            Apply <ArrowRight className="size-3 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Welcome back" description="Loading your dashboard…" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-40 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card><CardContent className="p-6 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</CardContent></Card>
        <Card><CardContent className="p-6 space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12" />)}</CardContent></Card>
      </div>
    </div>
  )
}
