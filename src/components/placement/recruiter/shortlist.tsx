'use client'

import { Fragment, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, CardSkeleton, formatDate,
} from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Users, ChevronDown, ChevronRight, Target, AlertTriangle, Lightbulb, ArrowRight, UserCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobListItem {
  id: string
  title: string
  status: string
  requiredSkillCount: number
  preferredSkillCount: number
}
interface JobsResponse { data: JobListItem[]; total: number }

interface MissingSkillRow {
  skillId: string
  name: string
  weight: number
  isRequired: boolean
  status: string
}
interface MatchingSkillRow {
  skillId: string
  name: string
  evidenceIds: string[]
}

interface CandidateRow {
  id: string
  jobId: string
  studentId: string
  studentName: string
  branch?: string | null
  batch?: string | null
  cgpa?: number | null
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  missingSkills: MissingSkillRow[]
  matchingSkills: MatchingSkillRow[]
  updatedAt: string
}
interface CandidatesResponse { data: CandidateRow[]; total: number }

interface PairMatch {
  jobId: string
  studentId: string
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: MatchingSkillRow[]
  missingSkills: MissingSkillRow[]
  factorsSummary: string
  recommendation: string
  algorithmVersion?: string
  storedAt?: string | null
}

export function Shortlist() {
  const navigate = useAppStore(s => s.navigate)
  const routeJobId = useAppStore(s => s.route.params?.jobId)

  // Load company's jobs (auto-filtered by recruiter's company)
  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ['recruiter-jobs', 'all'],
    queryFn: () => apiGet<JobsResponse>('/api/jobs?status=ALL&take=100'),
    staleTime: 60_000,
  })

  const jobs = jobsQuery.data?.data ?? []
  const [selectedJobId, setSelectedJobId] = useState<string>(routeJobId ?? '')
  const [minScore, setMinScore] = useState(0)
  const [requiredCoverageOnly, setRequiredCoverageOnly] = useState(false)

  // Derived: fall back to first available job when nothing is selected
  const activeJobId = selectedJobId || (jobs.length > 0 ? jobs[0].id : '')

  const matchesUrl = useMemo(() => {
    if (!activeJobId) return null
    const params = new URLSearchParams()
    params.set('minScore', String(minScore))
    if (requiredCoverageOnly) params.set('requiredCoverageOnly', 'true')
    params.set('skip', '0')
    params.set('take', '100')
    return `/api/matches/job/${activeJobId}?${params.toString()}`
  }, [activeJobId, minScore, requiredCoverageOnly])

  const matchesQuery = useQuery<CandidatesResponse>({
    queryKey: ['job-candidates', matchesUrl],
    queryFn: () => apiGet<CandidatesResponse>(matchesUrl!),
    enabled: Boolean(matchesUrl),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate shortlists"
        description="Ranked candidates per job — based on verified evidence"
      >
        <Button variant="outline" size="sm" onClick={() => navigate('recruiter/jobs')}>
          <Users className="size-4 mr-1" /> Manage jobs
        </Button>
      </PageHeader>

      {/* Filters card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Job</Label>
              <Select
                value={activeJobId}
                onValueChange={v => setSelectedJobId(v)}
                disabled={jobsQuery.isLoading || jobs.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={jobsQuery.isLoading ? 'Loading jobs…' : 'Pick a job'} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} ({j.requiredSkillCount}/{j.preferredSkillCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span>Minimum fit score</span>
                <span className="tabular-nums text-foreground">{minScore}%</span>
              </Label>
              <div className="pt-2">
                <Slider
                  value={[minScore]}
                  onValueChange={v => setMinScore(v[0] ?? 0)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <div>
              <Label htmlFor="rco-switch" className="text-sm font-medium">Required coverage only</Label>
              <p className="text-xs text-muted-foreground">Show only candidates who meet every required skill</p>
            </div>
            <Switch
              id="rco-switch"
              checked={requiredCoverageOnly}
              onCheckedChange={setRequiredCoverageOnly}
            />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {!activeJobId ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Users}
              title="Pick a job to shortlist"
              description={jobs.length === 0 ? 'No jobs for your company yet — create one to start ranking candidates' : 'Select a job from the picker above'}
              action={jobs.length === 0 && (
                <Button size="sm" onClick={() => navigate('recruiter/jobs')}>Create job</Button>
              )}
            />
          </CardContent>
        </Card>
      ) : matchesQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : matchesQuery.isError ? (
        <ErrorState
          message={(matchesQuery.error as Error)?.message ?? 'Failed to load candidates'}
          onRetry={() => matchesQuery.refetch()}
        />
      ) : (matchesQuery.data?.data ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Target}
              title="No candidates match these filters"
              description="Ask the placement officer to recompute matches for this job. You can also try lowering the minimum score or turning off the required-coverage filter."
              action={
                <Button size="sm" variant="outline" onClick={() => { setMinScore(0); setRequiredCoverageOnly(false) }}>
                  Reset filters
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <CandidatesTable
          jobId={activeJobId}
          candidates={matchesQuery.data!.data}
          onCandidateClick={(studentId) => navigate('recruiter/candidates', { id: studentId, jobId: activeJobId })}
        />
      )}
    </div>
  )
}

function CandidatesTable({
  jobId, candidates, onCandidateClick,
}: {
  jobId: string
  candidates: CandidateRow[]
  onCandidateClick: (studentId: string) => void
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div>
            <h3 className="text-sm font-semibold">{candidates.length} ranked candidate{candidates.length === 1 ? '' : 's'}</h3>
            <p className="text-xs text-muted-foreground">Sorted by fit score (highest first)</p>
          </div>
          <Badge variant="outline" className="text-xs">Top {Math.min(100, candidates.length)}</Badge>
        </div>
        <ScrollArea className="max-h-[600px] scroll-area-thin">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-10">#</TableHead>
                <TableHead className="text-xs">Candidate</TableHead>
                <TableHead className="text-xs">Batch</TableHead>
                <TableHead className="text-xs">Branch</TableHead>
                <TableHead className="text-xs text-right">CGPA</TableHead>
                <TableHead className="text-xs text-right">Fit score</TableHead>
                <TableHead className="text-xs text-right">Required cov.</TableHead>
                <TableHead className="text-xs text-center">Missing</TableHead>
                <TableHead className="text-xs text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((c, idx) => {
                const rowKey = `${c.jobId}-${c.studentId}`
                const expanded = expandedRow === rowKey
                return (
                  <Fragment key={rowKey}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setExpandedRow(expanded ? null : rowKey)}
                    >
                      <TableCell className="font-semibold tabular-nums text-sm">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          {c.studentName}
                        </div>
                        {c.branch && <div className="text-xs text-muted-foreground">{c.branch}</div>}
                      </TableCell>
                      <TableCell className="text-xs">{c.batch ?? '—'}</TableCell>
                      <TableCell className="text-xs">{c.branch ?? '—'}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {c.cgpa != null ? c.cgpa.toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <FitScoreBadge score={c.fitScore} />
                      </TableCell>
                      <TableCell className="text-right">
                        <CoverageBadge value={c.requiredCoverage} />
                      </TableCell>
                      <TableCell className="text-center">
                        {c.missingSkills.length === 0 ? (
                          <Badge variant="outline" className="text-xs bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30">
                            None
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30">
                            {c.missingSkills.length}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onCandidateClick(c.studentId)
                          }}
                        >
                          View <ArrowRight className="size-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded && (
                      <tr className="bg-muted/30">
                        <TableCell colSpan={9} className="p-3">
                          <ExpandedCandidate jobId={jobId} candidate={c} />
                        </TableCell>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

function ExpandedCandidate({ jobId, candidate }: { jobId: string; candidate: CandidateRow }) {
  const { data, isLoading, isError, error } = useQuery<PairMatch>({
    queryKey: ['pair-match', jobId, candidate.studentId],
    queryFn: () => apiGet<PairMatch>(`/api/matches/${jobId}/${candidate.studentId}`),
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div>
        <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-1/2" /></div>
      </div>
    )
  }
  if (isError) {
    return (
      <div className="text-sm text-[var(--danger-foreground)]">
        Failed to load match breakdown: {(error as Error)?.message}
      </div>
    )
  }
  if (!data) return null

  const missingRequired = candidate.missingSkills.filter(s => s.isRequired)
  const missingPreferred = candidate.missingSkills.filter(s => !s.isRequired)
  const matchingCount = candidate.matchingSkills.length

  return (
    <div className="space-y-4">
      {/* Recommendation banner */}
      {data.recommendation && (
        <div className={cn(
          'text-sm rounded-md p-3 border flex items-start gap-2',
          candidate.fitScore >= 50
            ? 'bg-[var(--verified-muted)] border-[var(--verified)]/30 text-[var(--verified-foreground)]'
            : 'bg-[var(--pending-muted)] border-[var(--pending)]/30 text-[var(--pending-foreground)]'
        )}>
          <Lightbulb className="size-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Recommendation:</span> {data.recommendation}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Matching skills */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <UserCheck className="size-3" /> Matching skills ({matchingCount})
          </h4>
          {candidate.matchingSkills.length === 0 ? (
            <p className="text-xs text-muted-foreground">None matched</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {candidate.matchingSkills.map(s => (
                <SkillTag key={s.skillId} name={s.name} isVerified />
              ))}
            </div>
          )}
          {data.factorsSummary && (
            <p className="text-xs text-muted-foreground mt-3 bg-muted rounded p-2">
              {data.factorsSummary}
            </p>
          )}
        </div>

        {/* Missing skills */}
        <div>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
            <AlertTriangle className="size-3" /> Missing skills ({candidate.missingSkills.length})
          </h4>
          {candidate.missingSkills.length === 0 ? (
            <p className="text-xs text-[var(--verified-foreground)] bg-[var(--verified-muted)] rounded p-2">
              <UserCheck className="size-3 inline mr-1" /> Covers every required and preferred skill!
            </p>
          ) : (
            <div className="space-y-2">
              {missingRequired.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[var(--danger-foreground)] mb-1">Required gaps</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingRequired.map(s => (
                      <SkillTag key={s.skillId} name={s.name} isRequired />
                    ))}
                  </div>
                </div>
              )}
              {missingPreferred.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-[var(--pending-foreground)] mb-1">Preferred gaps</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingPreferred.map(s => (
                      <SkillTag key={s.skillId} name={s.name} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground border-t pt-2">
        Last updated {formatDate(candidate.updatedAt)} · Algorithm v{data.algorithmVersion ?? '1.0'}
      </div>
    </div>
  )
}
