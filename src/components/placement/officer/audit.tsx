'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import {
  PageHeader, EmptyState, ErrorState,
} from '@/components/placement/shared/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ScrollText, Search, Loader2, User,
} from 'lucide-react'
import { formatDateTime } from '@/components/placement/shared/ui'

interface AuditRow {
  id: string
  actorId: string
  actorName: string
  actorEmail: string
  actorRole: string
  action: string
  targetType?: string | null
  targetId?: string | null
  reason?: string | null
  metadata?: string | null
  timestamp: string
}
interface AuditResponse { data: AuditRow[]; total: number; skip: number; take: number }

const PAGE_SIZE = 50

// Role badge tones
const ROLE_CLS: Record<string, string> = {
  OFFICER: 'bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30',
  ADMIN: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  RECRUITER: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  STUDENT: 'bg-muted text-muted-foreground border-border',
}

export function Audit() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [skip, setSkip] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    p.set('skip', String(skip))
    p.set('take', String(PAGE_SIZE))
    return `/api/audit?${p.toString()}`
  }, [skip])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AuditResponse>({
    queryKey: ['audit', url],
    queryFn: () => apiGet<AuditResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const all = data?.data ?? []
  const filtered = useMemo(() => {
    if (!search) return all
    const s = search.toLowerCase()
    return all.filter((e) =>
      e.action.toLowerCase().includes(s) ||
      e.actorName.toLowerCase().includes(s) ||
      e.actorEmail.toLowerCase().includes(s) ||
      (e.targetType ?? '').toLowerCase().includes(s) ||
      (e.reason ?? '').toLowerCase().includes(s)
    )
  }, [all, search])

  const total = data?.total ?? 0
  const hasMore = skip + all.length < total

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description={`${total} event${total === 1 ? '' : 's'} recorded`}
      />

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="audit-search">Search by action, actor, target</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                id="audit-search"
                placeholder="e.g. EVIDENCE_REVIEW, sharma@…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {isFetching && filtered.length > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Refreshing…
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message ?? 'Failed to load audit log'} onRetry={() => refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={search ? 'No events match your search' : 'No audit events yet'}
              description={search ? 'Try a different action name or actor email' : 'Audit events will appear here as actions happen'}
            />
          ) : (
            <ScrollArea className="max-h-[70vh] scroll-area-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Target</TableHead>
                    <TableHead className="hidden lg:table-cell">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(e.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                            <User className="size-3" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{e.actorName}</div>
                            <div className="text-xs text-muted-foreground">{e.actorEmail}</div>
                          </div>
                          <Badge variant="outline" className={`text-xs ${ROLE_CLS[e.actorRole] ?? ''}`}>
                            {e.actorRole}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {e.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {e.targetType ? (
                          <div>
                            <div className="font-medium">{e.targetType}</div>
                            {e.targetId && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={e.targetId}>
                                {e.targetId}
                              </div>
                            )}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground max-w-xs">
                        <div className="truncate" title={e.reason ?? ''}>
                          {e.reason ?? '—'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Showing {skip + 1}–{skip + all.length} of {total}
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
