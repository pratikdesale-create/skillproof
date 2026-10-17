'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, StatCard, CardSkeleton, EmptyState, ErrorState,
  formatDateTime, formatRelativeTime,
} from '@/components/placement/shared/ui'
import { StatusBadge, FitScoreBadge, CoverageBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Users, Briefcase, ShieldCheck, Target, CalendarClock, DollarSign,
  ArrowRight, ListOrdered, Activity, PieChart as PieIcon, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OfficerDashboard } from '@/types'

const STAGE_ORDER = [
  'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT',
  'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
] as const

// Restrained chart palette pulled from globals.css --chart-1..5
const PIE_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
]

interface JobsListResponse {
  data: Array<{ id: string; title: string; company: { name: string }; status: string }>
  total: number
}

interface MatchRowLite {
  matchId: string
  studentId: string
  studentName: string
  batch?: string | null
  branch?: string | null
  fitScore: number
  requiredCoverage: number
  missingSkillsCount?: number
}
interface JobMatchesResponse { data: MatchRowLite[]; total: number }

export function Dashboard() {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery<OfficerDashboard>({
    queryKey: ['officer-dashboard'],
    queryFn: () => apiGet<OfficerDashboard>('/api/dashboard/officer'),
    staleTime: 30_000,
  })

  // Top-matches job picker
  const [topJobId, setTopJobId] = useState<string>('')

  const jobsQuery = useQuery<JobsListResponse>({
    queryKey: ['officer-dashboard-jobs'],
    queryFn: () => apiGet<JobsListResponse>('/api/jobs?status=OPEN&skip=0&take=100'),
    staleTime: 60_000,
  })

  // Pick first job when none selected — derive effectiveJobId at render time
  // so we never need to setState-in-effect.
  const effectiveTopJobId = topJobId || jobsQuery.data?.data[0]?.id || ''

  const matchesUrl = effectiveTopJobId
    ? `/api/matches/job/${effectiveTopJobId}?skip=0&take=5`
    : null
  const matchesQuery = useQuery<JobMatchesResponse>({
    queryKey: ['officer-dashboard-top-matches', effectiveTopJobId],
    queryFn: () => apiGet<JobMatchesResponse>(matchesUrl!),
    enabled: Boolean(matchesUrl),
    staleTime: 30_000,
  })

  const recomputeAll = useMutation({
    mutationFn: () => apiPost<{ computed: number }>('/api/matches/recompute-all'),
    onSuccess: (resp) => {
      toast.success(`Recomputed ${resp.computed} match results`)
      qc.invalidateQueries({ queryKey: ['officer-dashboard'] })
      navigate('officer/ranking')
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to recompute matches')
    },
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

  const stageRows = STAGE_ORDER
    .map((s) => ({ stage: s, count: data.applicationsByStage[s] ?? 0 }))
    .filter((r) => r.count > 0)

  const sourceRows = Object.entries(data.jobsBySource).map(([source, count]) => ({
    source,
    count,
  }))

  const recent = data.recentActivity ?? []
  const totalApps = Object.values(data.applicationsByStage).reduce((a, b) => a + b, 0)
  const topMatches = matchesQuery.data?.data ?? []

  return (
    <div className="space-y-6 route-fade-enter">
      <PageHeader
        title="Overview"
        description="Placement operations at a glance"
      >
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('officer/evidence')}
        >
          <ShieldCheck className="size-4 mr-1" />
          Pending evidence
          {data.pendingEvidenceCount > 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {data.pendingEvidenceCount}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          onClick={() => recomputeAll.mutate()}
          disabled={recomputeAll.isPending}
        >
          {recomputeAll.isPending
            ? <><ListOrdered className="size-4 mr-1 animate-pulse" /> Running…</>
            : <><ListOrdered className="size-4 mr-1" /> Run batch ranking</>}
        </Button>
      </PageHeader>

      {/* Stat cards — every one clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active students"
          value={data.totalActiveStudents}
          icon={Users}
          tone="info"
          onClick={() => navigate('officer/students')}
        />
        <StatCard
          label="Open jobs"
          value={data.totalOpenJobs}
          icon={Briefcase}
          tone="success"
          onClick={() => navigate('officer/jobs')}
        />
        <StatCard
          label="Pending evidence"
          value={data.pendingEvidenceCount}
          icon={ShieldCheck}
          tone={data.pendingEvidenceCount > 0 ? 'warning' : 'success'}
          emphasis={data.pendingEvidenceCount > 0}
          hint={data.pendingEvidenceCount > 0 ? 'Awaiting review' : 'All clear'}
          onClick={() => navigate('officer/evidence')}
        />
        <StatCard
          label="Matches computed"
          value={data.totalMatchesComputed}
          icon={Target}
          onClick={() => navigate('officer/ranking')}
        />
        <StatCard
          label="Interviews"
          value={data.totalInterviews}
          icon={CalendarClock}
          onClick={() => navigate('officer/interviews')}
        />
        <StatCard
          label="Offers"
          value={data.totalOffers}
          icon={DollarSign}
          tone="brand"
          onClick={() => navigate('officer/offers')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications by stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Applications by stage
            </CardTitle>
            <CardDescription>
              {totalApps} application{totalApps === 1 ? '' : 's'} across {stageRows.length || 0} stage{stageRows.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stageRows.length === 0 ? (
              <EmptyState icon={Activity} title="No applications yet" description="Once students apply, stages will appear here" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)' }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.15 }}
                    contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--card)' }}
                    formatter={(value: number) => [`${value} application${value === 1 ? '' : 's'}`, 'Count']}
                  />
                  <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]} fill="var(--primary)" maxBarSize={56} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Jobs by source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="size-4" /> Jobs by source
            </CardTitle>
            <CardDescription>How jobs enter the system</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceRows.length === 0 ? (
              <EmptyState icon={PieIcon} title="No jobs yet" description="Jobs will be categorized by source" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={sourceRows}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    label={(entry: { source?: string; count?: number }) =>
                      `${entry.source ?? ''}: ${entry.count ?? 0}`
                    }
                    labelLine={false}
                  >
                    {sourceRows.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--border)', fontSize: 12, background: 'var(--card)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top matches for selected job */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4" /> Top matches for a job
              </CardTitle>
              <CardDescription>Highest-fit candidates for the selected opening</CardDescription>
            </div>
            <div className="w-full max-w-xs">
              <Select
                value={effectiveTopJobId}
                onValueChange={(v) => setTopJobId(v)}
                disabled={jobsQuery.isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={jobsQuery.isLoading ? 'Loading jobs…' : 'Select a job'} />
                </SelectTrigger>
                <SelectContent>
                  {(jobsQuery.data?.data ?? []).map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} — {j.company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!effectiveTopJobId ? (
            <EmptyState icon={Target} title="No open jobs" description="Open jobs will appear here once added" />
          ) : matchesQuery.isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : matchesQuery.isError ? (
            <ErrorState message={(matchesQuery.error as Error)?.message ?? 'Failed to load matches'} onRetry={() => matchesQuery.refetch()} />
          ) : topMatches.length === 0 ? (
            <EmptyState
              icon={Target}
              title="No matches yet"
              description="Run batch ranking to compute matches for this job"
              action={<Button size="sm" variant="outline" onClick={() => navigate('officer/ranking', { jobId: effectiveTopJobId })}><ListOrdered className="size-4 mr-1" /> Open ranking</Button>}
            />
          ) : (
            <ScrollArea className="max-h-96 scroll-area-thin">
              <ul className="divide-y">
                {topMatches.map((m) => (
                  <li
                    key={m.matchId}
                    className="p-3 hover:bg-muted/40 cursor-pointer"
                    onClick={() => navigate('officer/students', { id: m.studentId })}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{m.studentName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {m.batch ? `${m.batch} · ` : ''}
                          {m.branch ?? ''}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {m.missingSkillsCount != null && m.missingSkillsCount > 0
                            ? `${m.missingSkillsCount} missing skill${m.missingSkillsCount === 1 ? '' : 's'}`
                            : 'All required skills covered'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
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

      {/* Recent placement activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="size-4" /> Recent placement activity
          </CardTitle>
          <CardDescription>Latest 10 application events</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <EmptyState icon={Activity} title="No recent activity" description="Application status updates will appear here" />
          ) : (
            <ScrollArea className="max-h-96 scroll-area-thin">
              <ul className="divide-y">
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className="p-3 hover:bg-muted/40 cursor-pointer"
                    onClick={() => navigate('officer/applications', { id: e.applicationId })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {e.studentName ?? 'Unknown student'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {e.jobTitle ?? 'Application'}{e.companyName ? ` · ${e.companyName}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {formatRelativeTime(e.timestamp)} · {formatDateTime(e.timestamp)}
                          {e.reason ? ` — ${e.reason}` : ''}
                        </div>
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
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Overview" description="Loading…" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
      <Card><CardContent className="p-6 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
    </div>
  )
}
