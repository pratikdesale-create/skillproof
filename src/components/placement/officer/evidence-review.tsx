'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState,
  formatDate, formatRelativeTime,
} from '@/components/placement/shared/ui'
import { EvidenceStatusBadge } from '@/components/placement/shared/skill-tag'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck, ArrowRight, Loader2, Inbox, Clock,
} from 'lucide-react'

interface PendingEvidenceItem {
  id: string
  type: string
  title: string
  description?: string | null
  sourceUrl?: string | null
  organization?: string | null
  assessor?: string | null
  score?: number | null
  maxScore?: number | null
  status: string
  submittedAt: string
  student: {
    id: string
    name: string
    email: string
    batch?: string | null
    branch?: string | null
    cgpa?: number | null
  }
  skills: Array<{ skillId: string; name: string; category?: string | null; relevance: number }>
}
interface PendingResponse { data: PendingEvidenceItem[]; total: number; skip: number; take: number }

const PAGE_SIZE = 20

type StatusFilter = 'ALL' | 'PENDING_REVIEW' | 'NEEDS_MORE_EVIDENCE' | 'UNVERIFIED'

export function EvidenceReview() {
  const navigate = useAppStore(s => s.navigate)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [skip, setSkip] = useState(0)

  const url = useMemo(() => {
    const p = new URLSearchParams()
    p.set('skip', String(skip))
    p.set('take', String(PAGE_SIZE))
    return `/api/evidence/pending?${p.toString()}`
  }, [skip])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<PendingResponse>({
    queryKey: ['evidence-pending', url],
    queryFn: () => apiGet<PendingResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const items = data?.data ?? []
  const filtered = statusFilter === 'ALL'
    ? items
    : items.filter((i) => i.status === statusFilter)

  // Backlog breakdown by status — surfaced as a sub-summary above the list.
  const backlog = useMemo(() => {
    const map: Record<string, number> = {}
    for (const i of items) {
      map[i.status] = (map[i.status] ?? 0) + 1
    }
    return map
  }, [items])

  const total = data?.total ?? 0
  const hasMore = skip + items.length < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence Reviews"
        description={`${total} evidence item${total === 1 ? '' : 's'} awaiting review`}
      >
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All pending</SelectItem>
            <SelectItem value="PENDING_REVIEW">Pending review</SelectItem>
            <SelectItem value="NEEDS_MORE_EVIDENCE">Needs more evidence</SelectItem>
            <SelectItem value="UNVERIFIED">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Backlog breakdown */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(backlog).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5">
              <EvidenceStatusBadge status={status as never} size="sm" />
              <span className="text-sm font-semibold tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState
              message={(error as Error)?.message ?? 'Failed to load evidence queue'}
              onRetry={() => refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={statusFilter === 'ALL' ? 'No pending evidence to review' : 'No items match this filter'}
              description={
                statusFilter === 'ALL'
                  ? 'All submitted evidence has been reviewed.'
                  : 'Try selecting a different status filter.'
              }
            />
          ) : (
            <ScrollArea className="max-h-[70vh] scroll-area-thin">
              <ul className="divide-y">
                {filtered.map((e) => (
                  <li
                    key={e.id}
                    className="p-4 hover:bg-muted/40 cursor-pointer"
                    onClick={() => navigate('officer/evidence', { id: e.id })}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate">{e.title}</div>
                          <EvidenceStatusBadge status={e.status as never} size="sm" />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {e.type.toLowerCase().replace(/_/g, ' ')}
                          {e.organization ? ` · ${e.organization}` : ''}
                          {e.assessor ? ` · Assessor: ${e.assessor}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <ShieldCheck className="size-3" />
                          <button
                            className="hover:underline"
                            onClick={(ev) => {
                              ev.stopPropagation()
                              navigate('officer/students', { id: e.student.id })
                            }}
                          >
                            {e.student.name}
                          </button>
                          {e.student.batch ? ` · ${e.student.batch}` : ''}
                          {e.student.branch ? ` · ${e.student.branch}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="size-3" /> Submitted {formatDate(e.submittedAt)}
                          <span className="text-muted-foreground/70">· {formatRelativeTime(e.submittedAt)}</span>
                        </div>
                        {e.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {e.skills.slice(0, 5).map((s) => (
                              <SkillTag key={s.skillId} name={s.name} size="sm" />
                            ))}
                            {e.skills.length > 5 && (
                              <Badge variant="outline" className="text-xs">
                                +{e.skills.length - 5} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {e.score != null && (
                          <Badge variant="outline" className="text-xs tabular-nums">
                            Score: {e.score}{e.maxScore != null ? `/${e.maxScore}` : ''}
                          </Badge>
                        )}
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {skip + 1}–{skip + items.length} of {total}
          </p>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSkip((s) => s + PAGE_SIZE)}
              disabled={isFetching}
            >
              {isFetching ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
