'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState,
} from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ListOrdered, Loader2, Download, RefreshCw, ChevronDown, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface JobsListResponse {
  data: Array<{
    id: string
    title: string
    company: { id: string; name: string }
    status: string
  }>
  total: number
}

interface RankingRow {
  rank: number
  matchId: string
  jobId: string
  studentId: string
  studentName: string
  batch: string
  branch: string
  cgpa: number | string
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  missingSkillsCount: number
  missingSkillsCsv: string
}
interface RankingResponse { data: RankingRow[]; total: number }

interface MatchExplanation {
  jobId: string
  studentId: string
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: Array<{ skillId: string; name: string; evidenceIds: string[] }>
  missingSkills: Array<{ skillId: string; name: string; weight: number; isRequired: boolean; status: string }>
  breakdown: Array<{ skillId: string; displayName: string; isRequired: boolean; weight: number; matchValue: number; evidenceCount: number }>
  factorsSummary: string
  recommendation: string
}

export function Ranking({ initialJobId }: { initialJobId?: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const [jobId, setJobId] = useState<string>(initialJobId ?? '')
  const [minScore, setMinScore] = useState(0)
  const [requiredCoverageOnly, setRequiredCoverageOnly] = useState(false)

  // Load jobs for picker
  const jobsQuery = useQuery<JobsListResponse>({
    queryKey: ['officer-jobs-for-ranking'],
    queryFn: () => apiGet<JobsListResponse>('/api/jobs?status=OPEN&skip=0&take=100'),
    staleTime: 60_000,
  })

  // Pick first job if none selected — derive effectiveJobId at render time so we never
  // need to setState-in-effect.
  const effectiveJobId = jobId || jobsQuery.data?.data[0]?.id || ''

  const url = useMemo(() => {
    if (!effectiveJobId) return null
    const p = new URLSearchParams()
    p.set('jobId', effectiveJobId)
    if (minScore > 0) p.set('minScore', String(minScore))
    if (requiredCoverageOnly) p.set('requiredCoverageOnly', 'true')
    p.set('skip', '0')
    p.set('take', '100')
    return `/api/matches/ranking?${p.toString()}`
  }, [effectiveJobId, minScore, requiredCoverageOnly])

  const rankingQuery = useQuery<RankingResponse>({
    queryKey: ['ranking', url],
    queryFn: () => apiGet<RankingResponse>(url!),
    enabled: Boolean(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const recomputeMutation = useMutation({
    mutationFn: () => apiPost<{ computed: number }>(`/api/matches/recompute/${effectiveJobId}`),
    onSuccess: (resp) => {
      toast.success(`Recomputed ${resp.computed} matches`)
      qc.invalidateQueries({ queryKey: ['ranking'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to recompute')
    },
  })

  const rows = rankingQuery.data?.data ?? []
  const total = rankingQuery.data?.total ?? 0

  const selectedJob = jobsQuery.data?.data.find((j) => j.id === effectiveJobId)

  async function exportCsv() {
    if (!effectiveJobId || !selectedJob) return
    const p = new URLSearchParams()
    p.set('jobId', effectiveJobId)
    p.set('format', 'csv')
    if (minScore > 0) p.set('minScore', String(minScore))
    try {
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
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Ranking"
        description={selectedJob ? `Candidates ranked for ${selectedJob.title}` : 'Pick a job to see ranked candidates'}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={!effectiveJobId || rows.length === 0}
        >
          <Download className="size-4 mr-1" /> Export CSV
        </Button>
        <Button
          size="sm"
          onClick={() => recomputeMutation.mutate()}
          disabled={!effectiveJobId || recomputeMutation.isPending}
        >
          {recomputeMutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCw className="size-4 mr-1" />}
          Recompute
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Job</Label>
              <Select
                value={effectiveJobId}
                onValueChange={(v) => setJobId(v)}
                disabled={jobsQuery.isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={jobsQuery.isLoading ? 'Loading jobs…' : 'Select job'} />
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
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">
                Min score: <span className="font-medium tabular-nums">{minScore}</span>
              </Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[minScore]}
                onValueChange={(v) => setMinScore(v[0] ?? 0)}
              />
            </div>
            <div className="space-y-1.5 flex items-end">
              <label className="flex items-center gap-2 text-sm pb-2">
                <Switch
                  checked={requiredCoverageOnly}
                  onCheckedChange={setRequiredCoverageOnly}
                />
                <span>Required coverage only (100%)</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {!effectiveJobId ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ListOrdered}
              title="No job selected"
              description="Pick a job above to see ranked candidates"
            />
          </CardContent>
        </Card>
      ) : rankingQuery.isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </CardContent>
        </Card>
      ) : rankingQuery.isError ? (
        <ErrorState
          message={(rankingQuery.error as Error)?.message ?? 'Failed to load ranking'}
          onRetry={() => rankingQuery.refetch()}
        />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ListOrdered}
              title="No candidates match"
              description="Try lowering the minimum score or disabling the coverage filter"
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Batch</TableHead>
                  <TableHead className="hidden lg:table-cell">Branch</TableHead>
                  <TableHead className="hidden lg:table-cell">CGPA</TableHead>
                  <TableHead>Fit</TableHead>
                  <TableHead className="hidden md:table-cell">Coverage</TableHead>
                  <TableHead className="hidden md:table-cell">Missing</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <RankingRowItem
                    key={r.matchId}
                    row={r}
                    jobId={effectiveJobId}
                    onStudentClick={() => navigate(`officer/students/${r.studentId}`)}
                  />
                ))}
              </TableBody>
            </Table>
            <div className="p-3 text-xs text-slate-500 border-t">
              Showing {rows.length} of {total} candidate{total === 1 ? '' : 's'}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function RankingRowItem({
  row, jobId, onStudentClick,
}: {
  row: RankingRow
  jobId: string
  onStudentClick: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const missingList = row.missingSkillsCsv
    ? row.missingSkillsCsv.split(';').filter(Boolean)
    : []
  // Lazy-load explanation on expand
  const explanationQuery = useQuery<MatchExplanation>({
    queryKey: ['match-explanation', jobId, row.studentId],
    queryFn: () => apiGet<MatchExplanation>(`/api/matches/${jobId}/${row.studentId}`),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <TableCell className="font-bold tabular-nums text-slate-500">{row.rank}</TableCell>
        <TableCell>
          <button
            className="font-medium text-sm hover:underline text-left"
            onClick={(e) => { e.stopPropagation(); onStudentClick() }}
          >
            {row.studentName}
          </button>
          <div className="text-xs text-slate-500 md:hidden">
            {row.batch} · {row.branch}
          </div>
        </TableCell>
        <TableCell className="hidden md:table-cell text-sm">{row.batch || '—'}</TableCell>
        <TableCell className="hidden lg:table-cell text-sm">{row.branch || '—'}</TableCell>
        <TableCell className="hidden lg:table-cell text-sm tabular-nums">
          {typeof row.cgpa === 'number' ? row.cgpa.toFixed(2) : (row.cgpa || '—')}
        </TableCell>
        <TableCell><FitScoreBadge score={row.fitScore} /></TableCell>
        <TableCell className="hidden md:table-cell"><CoverageBadge value={row.requiredCoverage} /></TableCell>
        <TableCell className="hidden md:table-cell text-sm">
          {row.missingSkillsCount === 0 ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
              All covered
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300">
              {row.missingSkillsCount} missing
            </Badge>
          )}
        </TableCell>
        <TableCell>
          {expanded
            ? <ChevronDown className="size-4 text-slate-400" />
            : <ChevronRight className="size-4 text-slate-400" />}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-slate-50 dark:bg-slate-900">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Match explanation</h4>
                {explanationQuery.isLoading && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Loading…
                  </span>
                )}
              </div>
              {explanationQuery.data && (
                <>
                  {explanationQuery.data.factorsSummary && (
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {explanationQuery.data.factorsSummary}
                    </p>
                  )}
                  {explanationQuery.data.recommendation && (
                    <div className="rounded-md border border-slate-200 dark:border-slate-800 p-2 text-sm">
                      <span className="font-medium">Recommendation:</span>{' '}
                      {explanationQuery.data.recommendation}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                        Matching skills ({explanationQuery.data.matchingSkills.length})
                      </div>
                      {explanationQuery.data.matchingSkills.length === 0 ? (
                        <p className="text-xs text-slate-500">None</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {explanationQuery.data.matchingSkills.map((s) => (
                            <SkillTag key={s.skillId} name={s.name} isVerified size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                        Missing skills ({explanationQuery.data.missingSkills.length})
                      </div>
                      {explanationQuery.data.missingSkills.length === 0 ? (
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">
                          All required & preferred skills covered!
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {explanationQuery.data.missingSkills.map((s) => (
                            <SkillTag key={s.skillId} name={s.name} isRequired={s.isRequired} size="sm" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              {missingList.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                    Missing skills (CSV)
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {missingList.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
