'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, StatCard, CardSkeleton, EmptyState, ErrorState,
  formatDateTime,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Users, Briefcase, ShieldCheck, Target, Calendar, DollarSign,
  ArrowRight, ListOrdered, Activity, PieChart as PieIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OfficerDashboard } from '@/types'

const STAGE_ORDER = [
  'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT',
  'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
] as const

const PIE_COLORS = ['#0f766e', '#a16207', '#7c3aed', '#be123c', '#0369a1', '#475569']

export function Dashboard() {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery<OfficerDashboard>({
    queryKey: ['officer-dashboard'],
    queryFn: () => apiGet<OfficerDashboard>('/api/dashboard/officer'),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Placement operations overview"
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
          <ListOrdered className="size-4 mr-1" />
          {recomputeAll.isPending ? 'Running…' : 'Run batch ranking'}
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active students"
          value={data.totalActiveStudents}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Open jobs"
          value={data.totalOpenJobs}
          icon={Briefcase}
          tone="success"
        />
        <StatCard
          label="Pending evidence"
          value={data.pendingEvidenceCount}
          icon={ShieldCheck}
          tone={data.pendingEvidenceCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Matches computed"
          value={data.totalMatchesComputed}
          icon={Target}
        />
        <StatCard
          label="Interviews"
          value={data.totalInterviews}
          icon={Calendar}
        />
        <StatCard
          label="Offers"
          value={data.totalOffers}
          icon={DollarSign}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applications by stage */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Applications by stage
            </CardTitle>
            <CardDescription>Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {stageRows.length === 0 ? (
              <EmptyState icon={Activity} title="No applications yet" description="Once students apply, stages will appear here" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis
                    dataKey="stage"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={{ fillOpacity: 0.2 }}
                    contentStyle={{ borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]} fill="#0f766e" />
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
                  <Tooltip contentStyle={{ borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
            <EmptyState icon={Activity} title="No recent activity" description="Apply / status updates will appear here" />
          ) : (
            <ScrollArea className="max-h-96">
              <ul className="divide-y">
                {recent.map((e) => (
                  <li
                    key={e.id}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                    onClick={() => navigate(`officer/applications/${e.applicationId}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {e.studentName ?? '—'}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {e.jobTitle ?? 'Application'}{e.companyName ? ` · ${e.companyName}` : ''}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {formatDateTime(e.timestamp)}
                          {e.reason ? ` — ${e.reason}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {e.previousStatus && <StatusBadge status={e.previousStatus} />}
                        {e.previousStatus && <ArrowRight className="size-3 text-slate-400" />}
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
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Loading…" />
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
