'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Briefcase, ArrowRight, Inbox, Clock,
  FileText, Eye, ShieldCheck, ClipboardCheck, Users, Trophy, XCircle, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApplicationStatus } from '@/types'

interface ApplicationRow {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  jobId: string
  jobTitle: string
  companyId: string
  companyName: string
  status: ApplicationStatus
  appliedAt: string
  coverLetter?: string | null
  resume?: { id: string; title: string } | null
}
interface ApplicationsResponse { data: ApplicationRow[]; total: number }

// Each column has a distinct color theme — vibrant but professional
const COLUMNS: Array<{
  status: ApplicationStatus
  label: string
  icon: React.ComponentType<{ className?: string }>
  headerGradient: string
  cardBorder: string
  countBadge: string
}> = [
  { status: 'APPLIED',        label: 'Applied',        icon: FileText,       headerGradient: 'gradient-blue-subtle',     cardBorder: 'border-left-blue',    countBadge: 'bg-[var(--info)] text-[var(--info-foreground)]' },
  { status: 'UNDER_REVIEW',   label: 'Under Review',   icon: Eye,            headerGradient: 'gradient-amber-subtle',   cardBorder: 'border-left-amber',   countBadge: 'bg-[var(--pending)] text-[var(--pending-foreground)]' },
  { status: 'SHORTLISTED',    label: 'Shortlisted',    icon: ShieldCheck,    headerGradient: 'gradient-violet-subtle',   cardBorder: 'border-left-violet',  countBadge: 'bg-violet-500 text-white' },
  { status: 'ASSESSMENT',     label: 'Assessment',     icon: ClipboardCheck, headerGradient: 'gradient-cyan-subtle',    cardBorder: 'border-left-cyan',    countBadge: 'bg-cyan-500 text-white' },
  { status: 'INTERVIEW',      label: 'Interview',      icon: Users,          headerGradient: 'gradient-violet-subtle',   cardBorder: 'border-left-violet',  countBadge: 'bg-violet-500 text-white' },
  { status: 'OFFER',          label: 'Offer',          icon: Trophy,         headerGradient: 'gradient-emerald-subtle', cardBorder: 'border-left-emerald', countBadge: 'bg-[var(--verified)] text-[var(--verified-foreground)]' },
  { status: 'REJECTED',       label: 'Rejected',       icon: XCircle,        headerGradient: 'gradient-rose-subtle',     cardBorder: 'border-left-rose',    countBadge: 'bg-[var(--danger)] text-[var(--danger-foreground)]' },
  { status: 'WITHDRAWN',      label: 'Withdrawn',      icon: Ban,            headerGradient: '',                          cardBorder: '',                    countBadge: 'bg-muted text-muted-foreground' },
]

export function Applications() {
  const navigate = useAppStore(s => s.navigate)
  const { data, isLoading, isError, error, refetch } = useQuery<ApplicationsResponse>({
    queryKey: ['applications'],
    queryFn: () => apiGet<ApplicationsResponse>('/api/applications'),
    staleTime: 30_000,
  })

  if (isLoading) return <ApplicationsSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load applications'}
        onRetry={() => refetch()}
      />
    )
  }

  const apps = data?.data ?? []
  const byStatus = new Map<ApplicationStatus, ApplicationRow[]>()
  for (const a of apps) {
    const arr = byStatus.get(a.status) ?? []
    arr.push(a)
    byStatus.set(a.status, arr)
  }
  const total = apps.length

  return (
    <div className="space-y-6 route-fade-enter">
      <PageHeader
        title="My Applications"
        description={`${total} application${total === 1 ? '' : 's'} across the pipeline`}
      />

      {total === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Inbox}
              title="No applications yet"
              description="Explore matching roles to start your placement journey."
              action={
                <Button size="sm" onClick={() => navigate('student/jobs')}>
                  <Briefcase className="size-4 mr-2" /> Browse jobs
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const items = byStatus.get(col.status) ?? []
            const ColIcon = col.icon
            return (
              <Card key={col.status} className={cn('flex flex-col overflow-hidden', col.headerGradient)}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2 uppercase tracking-wider">
                      <ColIcon className="size-4 text-muted-foreground" />
                      {col.label}
                    </span>
                    <Badge className={cn('text-xs tabular-nums', col.countBadge)}>
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-2 bg-card/60">
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">No items</div>
                  ) : (
                    <ScrollArea className="max-h-96 scroll-area-thin">
                      <ul className="space-y-2">
                        {items.map((a) => (
                          <li
                            key={a.id}
                            className={cn(
                              'rounded-md border bg-card p-3 hover:shadow-sm cursor-pointer transition-all card-hover-lift',
                              col.cardBorder
                            )}
                            onClick={() => navigate(`student/applications/${a.id}`)}
                          >
                            <div className="text-sm font-medium truncate">{a.jobTitle}</div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">{a.companyName}</div>
                            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="size-3" />
                                {formatDate(a.appliedAt)}
                              </span>
                              {a.resume && (
                                <Badge variant="outline" className="text-xs">Resume</Badge>
                              )}
                            </div>
                            <Button size="sm" variant="ghost" className="w-full mt-2 h-7 text-xs">
                              View <ArrowRight className="size-3 ml-1" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ApplicationsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Applications" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
