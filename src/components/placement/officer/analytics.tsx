'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet, api } from '@/lib/api-client'
import {
  PageHeader, EmptyState, ErrorState, CardSkeleton, StatCard,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  BarChart3, PieChart as PieIcon, Activity, Download, Loader2, Users, Target,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OfficerDashboard } from '@/types'

const STAGE_ORDER = [
  'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT',
  'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
] as const

// Restrained chart palette from globals.css --chart-1..5
const PIE_COLORS = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)',
]

interface JobsListResponse {
  data: Array<{ id: string; title: string; company: { name: string }; status: string }>
  total: number
}

export function Analytics() {
  const { data, isLoading, isError, error, refetch } = useQuery<OfficerDashboard>({
    queryKey: ['officer-dashboard'],
    queryFn: () => apiGet<OfficerDashboard>('/api/dashboard/officer'),
    staleTime: 30_000,
  })

  const [exportJobId, setExportJobId] = useState('')
  const [exporting, setExporting] = useState(false)

  const jobsQuery = useQuery<JobsListResponse>({
    queryKey: ['officer-jobs-for-analytics'],
    queryFn: () => apiGet<JobsListResponse>('/api/jobs?status=OPEN&skip=0&take=100'),
    staleTime: 60_000,
  })

  const selectedJob = useMemo(
    () => jobsQuery.data?.data.find((j) => j.id === exportJobId) ?? null,
    [jobsQuery.data, exportJobId]
  )

  async function exportCsv() {
    if (!exportJobId || !selectedJob) return
    setExporting(true)
    try {
      const p = new URLSearchParams()
      p.set('jobId', exportJobId)
      p.set('format', 'csv')
      const blob = await api<string>(`/api/matches/ranking?${p.toString()}`)
      const csv = typeof blob === 'string' ? blob : ''
      const dlBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const dlUrl = URL.createObjectURL(dlBlob)
      const a = document.createElement('a')
      a.href = dlUrl
      a.download = `ranking-${selectedJob.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(dlUrl)
      toast.success('Ranking exported')
    } catch (err) {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <AnalyticsSkeleton />
  if (isError) {
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load analytics'} onRetry={() => refetch()} />
  }
  if (!data) return null

  const stageRows = STAGE_ORDER
    .map((s) => ({ stage: s, count: data.applicationsByStage[s] ?? 0 }))
    .filter((r) => r.count > 0)

  const sourceRows = Object.entries(data.jobsBySource).map(([source, count]) => ({
    source,
    count,
  }))

  const totalJobs = Object.values(data.jobsBySource).reduce((a, b) => a + b, 0)
  const totalApps = Object.values(data.applicationsByStage).reduce((a, b) => a + b, 0)
  const hasData = totalJobs > 0 || totalApps > 0 || data.totalActiveStudents > 0

  // Overall empty state when there's literally no data
  if (!hasData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Placement effectiveness across the system" />
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BarChart3}
              title="No analytics yet"
              description="Once students register and apply to jobs, charts will appear here."
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Placement effectiveness across the system"
      />

      {/* Top summary tiles — use StatCard for consistent design language */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Active students" value={data.totalActiveStudents} icon={Users} tone="info" />
        <StatCard label="Open jobs" value={data.totalOpenJobs} icon={BarChart3} tone="success" />
        <StatCard label="Matches computed" value={data.totalMatchesComputed} icon={Target} />
        <StatCard label="Total applications" value={totalApps} icon={Activity} tone="brand" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Applications by stage
            </CardTitle>
            <CardDescription>Current pipeline distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {stageRows.length === 0 ? (
              <EmptyState icon={Activity} title="No applications" description="Once students apply, stages will appear here" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="size-4" /> Jobs by source
            </CardTitle>
            <CardDescription>How jobs enter the system ({totalJobs} total)</CardDescription>
          </CardHeader>
          <CardContent>
            {sourceRows.length === 0 ? (
              <EmptyState icon={PieIcon} title="No jobs" description="Jobs will be categorized by source" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceRows}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    paddingAngle={2}
                    label={(entry: { source?: string; count?: number }) => `${entry.source ?? ''}: ${entry.count ?? 0}`}
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

      {/* Source effectiveness comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="size-4" /> Source effectiveness
          </CardTitle>
          <CardDescription>Where jobs come from</CardDescription>
        </CardHeader>
        <CardContent>
          {sourceRows.length === 0 ? (
            <EmptyState icon={BarChart3} title="No source data" description="Jobs will appear here once added" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {['MANUAL', 'FEED', 'ALUMNI', 'API', 'CSV'].map((src) => {
                const count = data.jobsBySource[src] ?? 0
                const pct = totalJobs > 0 ? Math.round((count / totalJobs) * 100) : 0
                return (
                  <div key={src} className="rounded-md border p-3">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{src}</div>
                    <div className="text-2xl font-bold tabular-nums mt-1">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pct}% of total</div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversion funnel: Applications → Interviews → Offers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> Conversion funnel
          </CardTitle>
          <CardDescription>Applications → interviews → offers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FunnelStep label="Applications" value={totalApps} tone="info" />
            <FunnelStep label="Interviews" value={data.totalInterviews} tone="warning" />
            <FunnelStep label="Offers" value={data.totalOffers} tone="success" />
          </div>
        </CardContent>
      </Card>

      {/* CSV export — only enabled when a job is selected */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="size-4" /> Export ranking CSV
          </CardTitle>
          <CardDescription>Select a job to download its ranked candidate list</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1 md:col-span-2">
              <Label className="text-xs text-muted-foreground">Job</Label>
              <Select
                value={exportJobId}
                onValueChange={setExportJobId}
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
            <Button
              onClick={exportCsv}
              disabled={!exportJobId || exporting}
              className="w-full md:w-auto"
            >
              {exporting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Download className="size-4 mr-1" />}
              Export CSV
            </Button>
          </div>
          {!exportJobId && (
            <p className="text-xs text-muted-foreground">
              Pick a job to enable the export button.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FunnelStep({
  label, value, tone,
}: {
  label: string
  value: number
  tone: 'info' | 'warning' | 'success'
}) {
  const cls = tone === 'success'
    ? 'bg-[var(--verified-muted)] border-[var(--verified)]/30 text-[var(--verified-foreground)]'
    : tone === 'warning'
    ? 'bg-[var(--pending-muted)] border-[var(--pending)]/30 text-[var(--pending-foreground)]'
    : 'bg-[var(--info-muted)] border-[var(--info)]/30 text-[var(--info-foreground)]'
  return (
    <div className={`rounded-md border p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Loading…" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
