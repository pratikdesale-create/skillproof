'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import {
  PageHeader, EmptyState, ErrorState, CardSkeleton,
} from '@/components/placement/shared/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Database, RefreshCw, Loader2, Globe, Calendar,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/components/placement/shared/ui'

interface JobSourceRow {
  id: string
  name: string
  type: string
  status: string
  endpoint?: string | null
  apiKey?: string | null
  lastSyncAt?: string | null
  syncInterval?: string | null
  createdAt: string
  updatedAt: string
}
interface JobSourcesResponse { data: JobSourceRow[] }

export function Sources() {
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery<JobSourcesResponse>({
    queryKey: ['job-sources'],
    queryFn: () => apiGet<JobSourcesResponse>('/api/job-sources'),
    staleTime: 30_000,
  })

  const syncMutation = useMutation({
    mutationFn: (id: string) => apiPost<{ ok: boolean; message: string; lastSyncAt: string }>(`/api/job-sources/${id}/sync`),
    onSuccess: (resp) => {
      toast.success(resp.message || 'Sync completed')
      qc.invalidateQueries({ queryKey: ['job-sources'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Sync failed')
    },
  })

  const sources = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Sources"
        description={`${sources.length} source${sources.length === 1 ? '' : 's'} configured`}
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message ?? 'Failed to load sources'} onRetry={() => refetch()} />
          ) : sources.length === 0 ? (
            <EmptyState
              icon={Database}
              title="No job sources"
              description="Sources enable automatic job ingestion from feeds, alumni networks, and APIs"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Endpoint</TableHead>
                  <TableHead className="hidden md:table-cell">Last sync</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-md bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                          <Database className="size-4 text-slate-500" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{s.name}</div>
                          <div className="text-xs text-slate-500 md:hidden">{s.type}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-xs">{s.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        s.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                        s.status === 'PAUSED' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300' :
                        'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300'
                      }>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {s.endpoint ? (
                        <a
                          href={s.endpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline"
                        >
                          <Globe className="size-3" />
                          <span className="truncate max-w-[200px]" title={s.endpoint}>{s.endpoint}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {s.lastSyncAt ? (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="size-3" />
                          {formatDateTime(s.lastSyncAt)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => syncMutation.mutate(s.id)}
                        disabled={syncMutation.isPending && syncMutation.variables === s.id}
                      >
                        {syncMutation.isPending && syncMutation.variables === s.id
                          ? <Loader2 className="size-4 mr-1 animate-spin" />
                          : <RefreshCw className="size-4 mr-1" />}
                        Sync now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 text-xs text-slate-500 space-y-1">
          <div className="font-medium text-sm text-slate-700 dark:text-slate-300 mb-2">About job sources</div>
          <p>• Sources let Placement Hub automatically pull jobs from external feeds, alumni networks, or partner APIs.</p>
          <p>• The <code>Sync now</code> action triggers a sync with the source. The current implementation updates the <code>lastSyncAt</code> timestamp and returns a demo payload — full ingestion is not configured in this demo build.</p>
          <p>• Contact your admin to enable real integration endpoints.</p>
        </CardContent>
      </Card>
    </div>
  )
}

export function SourcesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Job Sources" description="Loading…" />
      <CardSkeleton />
    </div>
  )
}
