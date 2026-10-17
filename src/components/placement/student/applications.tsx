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
} from 'lucide-react'
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

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: 'APPLIED', label: 'Applied' },
  { status: 'UNDER_REVIEW', label: 'Under Review' },
  { status: 'SHORTLISTED', label: 'Shortlisted' },
  { status: 'ASSESSMENT', label: 'Assessment' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'WITHDRAWN', label: 'Withdrawn' },
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
    <div className="space-y-6">
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
            return (
              <Card key={col.status} className="flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center justify-between">
                    <span className="uppercase tracking-wider text-muted-foreground">
                      {col.label}
                    </span>
                    <Badge variant="secondary" className="text-xs tabular-nums">
                      {items.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-2">
                  {items.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-6">No items</div>
                  ) : (
                    <ScrollArea className="max-h-96 scroll-area-thin">
                      <ul className="space-y-2">
                        {items.map((a) => (
                          <li
                            key={a.id}
                            className="rounded-md border p-3 hover:bg-muted/50 cursor-pointer transition-colors"
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
