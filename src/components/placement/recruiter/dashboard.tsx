'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, StatCard, CardSkeleton, EmptyState, ErrorState, formatDateTime,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Briefcase, Users, ListChecks, Clock, ArrowRight, Plus, UserCheck, Activity,
} from 'lucide-react'
import type { ApplicationStatus } from '@/types'

interface RecentActivityItem {
  id: string
  applicationId: string
  previousStatus?: string | null
  newStatus: ApplicationStatus
  reason?: string | null
  timestamp: string
  actor?: { id: string; name: string } | null
  studentName?: string
  jobTitle?: string
  companyName?: string
}

interface DashboardData {
  companyId: string
  openJobsForCompany: number
  totalCandidates: number
  shortlistedCount: number
  candidatesNeedingReview: number
  stageDistribution: Record<string, number>
  recentActivity: RecentActivityItem[]
}

const STAGE_ORDER: ApplicationStatus[] = [
  'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
]

const STAGE_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  UNDER_REVIEW: 'Under Review',
  SHORTLISTED: 'Shortlisted',
  ASSESSMENT: 'Assessment',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
}

export function Dashboard() {
  const navigate = useAppStore(s => s.navigate)
  const { data, isLoading, isError, error, refetch } = useQuery<DashboardData>({
    queryKey: ['recruiter-dashboard'],
    queryFn: () => apiGet<DashboardData>('/api/dashboard/recruiter'),
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

  const chartData = STAGE_ORDER
    .map(s => ({ status: s, label: STAGE_LABELS[s] ?? s, count: data.stageDistribution[s] ?? 0 }))
    .filter(d => d.count > 0)

  const reviewTone = data.candidatesNeedingReview > 0 ? 'warning' : 'default'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruiter Dashboard"
        description="Your company's pipeline at a glance"
      >
        <Button size="sm" onClick={() => navigate('recruiter/jobs')}>
          <Plus className="size-4 mr-1" /> Create job
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open jobs"
          value={data.openJobsForCompany}
          hint="Posted by your company"
          icon={Briefcase}
          tone="info"
        />
        <StatCard
          label="Total candidates"
          value={data.totalCandidates}
          hint="Distinct students applied"
          icon={Users}
        />
        <StatCard
          label="Shortlisted"
          value={data.shortlistedCount}
          hint="Currently in shortlist"
          icon={UserCheck}
          tone="success"
        />
        <StatCard
          label="Need review"
          value={data.candidatesNeedingReview}
          hint="UNDER_REVIEW applications"
          icon={Clock}
          tone={reviewTone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stage distribution */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4" /> Stage distribution
            </CardTitle>
            <CardDescription>Applications grouped by current stage</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No applications yet"
                description="Once candidates apply, you'll see the pipeline here"
              />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={48}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`${value} application${value === 1 ? '' : 's'}`, 'Count']}
                    />
                    <Bar
                      dataKey="count"
                      name="Applications"
                      fill="#0f172a"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="size-4" /> Quick actions
            </CardTitle>
            <CardDescription>Jump into your workflow</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('recruiter/jobs')}
              className="justify-start h-auto py-3 flex-col items-start"
            >
              <Briefcase className="size-4 mb-1" />
              <span className="text-sm font-medium">Manage jobs</span>
              <span className="text-xs text-slate-500">Post new roles, edit existing</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('recruiter/shortlist')}
              className="justify-start h-auto py-3 flex-col items-start"
            >
              <UserCheck className="size-4 mb-1" />
              <span className="text-sm font-medium">Review candidates</span>
              <span className="text-xs text-slate-500">Shortlist top fits per job</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('recruiter/applications')}
              className="justify-start h-auto py-3 flex-col items-start"
            >
              <ListChecks className="size-4 mb-1" />
              <span className="text-sm font-medium">Track pipeline</span>
              <span className="text-xs text-slate-500">See applications across stages</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4" /> Recent activity
          </CardTitle>
          <CardDescription>Last 10 application events for your company</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.recentActivity.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No recent activity"
              description="Application events will appear here as they happen"
            />
          ) : (
            <ScrollArea className="max-h-96">
              <ul className="divide-y">
                {data.recentActivity.map((e) => (
                  <li
                    key={e.id}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                    onClick={() => navigate(`recruiter/applications/${e.applicationId}`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {e.studentName ?? 'Unknown candidate'}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {e.jobTitle ?? 'Application'}
                          {e.companyName ? ` · ${e.companyName}` : ''}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 truncate">
                          by {e.actor?.name ?? 'System'}
                          {e.reason ? ` · ${e.reason}` : ''}
                          {' · '}{formatDateTime(e.timestamp)}
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

      {/* Stage legend */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage counts</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAGE_ORDER.map(s => (
              <div key={s} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={s} />
                  <Badge variant="secondary" className="tabular-nums text-xs">
                    {data.stageDistribution[s] ?? 0}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Recruiter Dashboard" description="Your company's pipeline at a glance" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-72 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
        </CardContent>
      </Card>
    </div>
  )
}
