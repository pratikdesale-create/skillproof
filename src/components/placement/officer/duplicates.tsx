'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, CardSkeleton, formatDate,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Copy, ArrowRight, Loader2, Building2, MapPin, Calendar, GitMerge, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface DuplicateJobSummary {
  id: string
  title: string
  companyId: string
  companyName: string
  location?: string | null
  postingDate: string
  status: string
}
interface DuplicateJobItem {
  id: string
  status: 'POSSIBLE' | 'CONFIRMED' | 'REJECTED' | 'MERGED'
  similarity: number
  reasons: string
  detectedAt: string
  resolvedAt?: string | null
  jobA: DuplicateJobSummary
  jobB: DuplicateJobSummary
}
interface DuplicatesResponse { data: DuplicateJobItem[] }

type StatusFilter = 'all' | 'possible' | 'confirmed'

export function Duplicates() {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const { data, isLoading, isError, error, refetch } = useQuery<DuplicatesResponse>({
    queryKey: ['job-duplicates'],
    queryFn: () => apiGet<DuplicatesResponse>('/api/jobs/duplicates'),
    staleTime: 30_000,
  })

  const mergeMutation = useMutation({
    mutationFn: (id: string) => apiPost<{
      archivedJobId: string
      survivingJobId: string
      applicationsMoved: number
      applicationsDeduped: number
    }>(`/api/jobs/duplicates/${id}/resolve`, { action: 'CONFIRM_MERGE' }),
    onSuccess: (resp) => {
      toast.success(`Merged — ${resp.applicationsMoved} application${resp.applicationsMoved === 1 ? '' : 's'} moved, ${resp.applicationsDeduped} deduped`)
      qc.invalidateQueries({ queryKey: ['job-duplicates'] })
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to merge')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/jobs/duplicates/${id}/resolve`, { action: 'REJECT' }),
    onSuccess: () => {
      toast.success('Marked as not duplicate')
      qc.invalidateQueries({ queryKey: ['job-duplicates'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to reject')
    },
  })

  const all = data?.data ?? []
  const filtered = useMemo(() => {
    if (statusFilter === 'all') return all
    return all.filter((d) => d.status.toLowerCase() === statusFilter)
  }, [all, statusFilter])

  if (isLoading) return <DuplicatesSkeleton />
  if (isError) {
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load duplicates'} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicate Review"
        description={`${all.length} duplicate pair${all.length === 1 ? '' : 's'} detected`}
      >
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="possible">Possible</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Copy}
              title={all.length === 0 ? 'No duplicates detected' : 'No items match filter'}
              description={
                all.length === 0
                  ? 'Creating or editing jobs will auto-detect potential duplicates'
                  : 'Try selecting a different status filter'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filtered.map((dup) => {
            let reasons: string[] = []
            try {
              const parsed = JSON.parse(dup.reasons)
              reasons = Array.isArray(parsed) ? parsed.map(String) : []
            } catch {
              reasons = dup.reasons ? [dup.reasons] : []
            }

            return (
              <Card key={dup.id}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Copy className="size-4 text-amber-600" />
                      Duplicate pair
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {(dup.similarity * 100).toFixed(0)}% similar
                      </Badge>
                      <Badge variant="outline" className={
                        dup.status === 'CONFIRMED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                        dup.status === 'POSSIBLE' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300' :
                        dup.status === 'MERGED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                        'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300'
                      }>
                        {dup.status}
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Detected {formatDate(dup.detectedAt)}
                    {dup.resolvedAt ? ` · Resolved ${formatDate(dup.resolvedAt)}` : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Reasons */}
                  {reasons.length > 0 && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Reasons</div>
                      <ul className="flex flex-wrap gap-2">
                        {reasons.map((r, i) => (
                          <li key={i}>
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900">
                              {r}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <DuplicateJobCard job={dup.jobA} onClick={() => navigate(`officer/jobs/${dup.jobA.id}`)} />
                    <DuplicateJobCard job={dup.jobB} onClick={() => navigate(`officer/jobs/${dup.jobB.id}`)} />
                  </div>

                  {/* Actions */}
                  {(dup.status === 'POSSIBLE' || dup.status === 'CONFIRMED') && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => rejectMutation.mutate(dup.id)}
                        disabled={rejectMutation.isPending || mergeMutation.isPending}
                      >
                        <XCircle className="size-4 mr-1" />
                        {rejectMutation.isPending && rejectMutation.variables === dup.id ? 'Rejecting…' : 'Not duplicate'}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white"
                            disabled={mergeMutation.isPending || rejectMutation.isPending}
                          >
                            <GitMerge className="size-4 mr-1" />
                            Merge
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Merge duplicate jobs?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The older job will be archived and its applications transferred to the surviving job.
                              Applications that already exist on the surviving job will be deduped.
                              This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => mergeMutation.mutate(dup.id)}
                              disabled={mergeMutation.isPending}
                              className="bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              {mergeMutation.isPending && mergeMutation.variables === dup.id ? 'Merging…' : 'Confirm merge'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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

function DuplicateJobCard({
  job, onClick,
}: {
  job: DuplicateJobSummary
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-md border p-3 hover:bg-slate-50 dark:hover:bg-slate-900 w-full space-y-1"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm">{job.title}</div>
        <ArrowRight className="size-3 text-slate-400 shrink-0 mt-0.5" />
      </div>
      <div className="text-xs text-slate-500 flex items-center gap-1">
        <Building2 className="size-3" />
        {job.companyName}
      </div>
      {job.location && (
        <div className="text-xs text-slate-500 flex items-center gap-1">
          <MapPin className="size-3" /> {job.location}
        </div>
      )}
      <div className="text-xs text-slate-400 flex items-center gap-1">
        <Calendar className="size-3" /> Posted {formatDate(job.postingDate)}
      </div>
      <Badge variant="outline" className="text-xs">
        {job.status}
      </Badge>
    </button>
  )
}

function DuplicatesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Duplicate Review" description="Loading…" />
      <Card><CardContent className="p-6 space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</CardContent></Card>
    </div>
  )
}
