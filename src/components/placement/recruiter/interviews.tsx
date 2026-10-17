'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, formatDateTime,
} from '@/components/placement/shared/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  CalendarClock, MapPin, Video, ArrowRight, ExternalLink,
} from 'lucide-react'

interface InterviewRow {
  id: string
  applicationId: string
  scheduledAt: string
  duration?: number | null
  location?: string | null
  meetingUrl?: string | null
  type: string
  round: number
  notes?: string | null
  outcome?: string | null
  application: {
    id: string
    status: string
    student: {
      id: string
      user: { id: string; name: string; email: string }
      batch?: string | null
      branch?: string | null
    }
    job: { id: string; title: string; company: { id: string; name: string } }
  }
}
interface InterviewsResponse { data: InterviewRow[]; total: number; skip: number; take: number }

type StatusFilter = 'upcoming' | 'past' | 'all'

const OUTCOME_TONES: Record<string, string> = {
  PASSED: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  FAILED: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  PENDING: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
}

function outcomeBadge(outcome?: string | null) {
  if (!outcome) {
    return (
      <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
        Scheduled
      </Badge>
    )
  }
  const cls = OUTCOME_TONES[outcome] ?? 'bg-muted text-muted-foreground border-border'
  const label = outcome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  )
}

export function Interviews() {
  const navigate = useAppStore(s => s.navigate)
  const [status, setStatus] = useState<StatusFilter>('upcoming')

  const url = useMemo(() => {
    const p = new URLSearchParams()
    p.set('status', status)
    p.set('skip', '0')
    p.set('take', '200')
    return `/api/interviews?${p.toString()}`
  }, [status])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<InterviewsResponse>({
    queryKey: ['recruiter-interviews', url],
    queryFn: () => apiGet<InterviewsResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Interviews"
        description={`${total} interview${total === 1 ? '' : 's'} ${status === 'upcoming' ? 'upcoming' : status === 'past' ? 'in the past' : 'recorded'}`}
      >
        <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState
              message={(error as Error)?.message ?? 'Failed to load interviews'}
              onRetry={() => refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title={status === 'upcoming' ? 'No interviews scheduled yet' : status === 'past' ? 'No past interviews' : 'No interviews'}
              description={
                status === 'upcoming'
                  ? 'Shortlist candidates and schedule interviews from the pipeline.'
                  : status === 'past'
                  ? 'Past interviews will appear here once conducted.'
                  : 'Schedule interviews from an application to see them here.'
              }
            />
          ) : (
            <ScrollArea className="max-h-[70vh] scroll-area-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">When</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead className="hidden md:table-cell">Role</TableHead>
                    <TableHead className="hidden md:table-cell">Type / Round</TableHead>
                    <TableHead className="hidden lg:table-cell">Location</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((iv) => (
                    <TableRow
                      key={iv.id}
                      className="cursor-pointer"
                      onClick={() => navigate('recruiter/applications', { id: iv.applicationId })}
                    >
                      <TableCell>
                        <div className="text-sm font-medium tabular-nums">
                          {formatDateTime(iv.scheduledAt)}
                        </div>
                        {iv.duration != null && (
                          <div className="text-xs text-muted-foreground">{iv.duration} min</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <button
                          className="text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('recruiter/candidates', { id: iv.application.student.id, jobId: iv.application.job.id })
                          }}
                        >
                          <div className="font-medium text-sm hover:underline">
                            {iv.application.student.user.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {iv.application.student.user.email}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm font-medium truncate max-w-[180px]">
                          {iv.application.job.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {iv.application.job.company.name}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {iv.type.replace(/_/g, ' ').toLowerCase()}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">Round {iv.round}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {iv.meetingUrl ? (
                          <a
                            href={iv.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-[var(--info-foreground)] hover:underline"
                          >
                            <Video className="size-3" /> Join
                            <ExternalLink className="size-3" />
                          </a>
                        ) : iv.location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3" /> {iv.location}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{outcomeBadge(iv.outcome)}</TableCell>
                      <TableCell>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          {isFetching && rows.length > 0 && (
            <div className="p-2 text-xs text-muted-foreground text-center">Refreshing…</div>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => navigate('recruiter/applications')}>
          <ArrowRight className="size-4 mr-1" /> Open recruitment pipeline
        </Button>
      )}
    </div>
  )
}
