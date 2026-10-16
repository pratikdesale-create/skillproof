'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, CardSkeleton, EmptyState, ErrorState, formatSalary, formatDate } from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge, StatusBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, Building2, MapPin, Calendar, ExternalLink, FileText, Send,
  CheckCircle2, AlertTriangle, Target, Lightbulb, Layers, ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AuthUser, StudentProfile, ClaimStatus } from '@/types'

interface JobCompany { id: string; name: string; industry?: string | null; website?: string | null }
interface JobRequirement {
  id: string
  skillId: string
  name: string
  category?: string | null
  weight: number
  isRequired: boolean
  minLevel?: string | null
}
interface JobDetail {
  id: string
  title: string
  companyId: string
  company: JobCompany
  description: string
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  minExperience?: number | null
  maxExperience?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  applicationUrl?: string | null
  postingDate: string
  closingDate?: string | null
  status: string
  sourceType: string
  sourceRef?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  eligibilityCriteria?: string | null
  batchEligible?: string | null
  createdAt: string
  updatedAt: string
  requirements: JobRequirement[]
}

interface EvidenceMatch {
  evidenceId: string
  status: string
  relevance: number
  type: string
  title: string
}

interface ScoreBreakdownRow {
  skillId: string
  displayName: string
  isRequired: boolean
  weight: number
  matchValue: number
  bestEvidence?: EvidenceMatch
  evidenceCount: number
}

interface MatchingSkillRow {
  skillId: string
  name: string
  evidenceIds: string[]
}

interface MissingSkillRow {
  skillId: string
  name: string
  weight: number
  isRequired: boolean
  status: string
}

interface MatchData {
  jobId: string
  studentId: string
  job?: { id: string; title: string; company: { name: string } } | null
  student?: { id: string; name: string } | null
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: MatchingSkillRow[]
  missingSkills: MissingSkillRow[]
  breakdown: ScoreBreakdownRow[]
  factorsSummary: string
  recommendation: string
  algorithmVersion: string
  storedAt?: string | null
}

interface MeResponse {
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
}

export function JobDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/me'),
    staleTime: 60_000,
  })
  const jobQuery = useQuery<JobDetail>({
    queryKey: ['job', id],
    queryFn: () => apiGet<JobDetail>(`/api/jobs/${id}`),
    staleTime: 60_000,
  })

  const studentId = meQuery.data?.profile?.id ?? null
  const matchQuery = useQuery<MatchData>({
    queryKey: ['match', id, studentId],
    queryFn: () => apiGet<MatchData>(`/api/matches/${id}/${studentId}`),
    enabled: Boolean(studentId) && !jobQuery.isLoading,
    staleTime: 60_000,
  })

  // Mutations
  const generateResumeMutation = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/resumes/generate', { jobId: id }),
    onSuccess: (resp) => {
      toast.success('Resume generated')
      qc.invalidateQueries({ queryKey: ['resumes'] })
      if (resp?.id) navigate(`student/resumes/${resp.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to generate resume')
    },
  })

  const applyMutation = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/applications', { jobId: id }),
    onSuccess: (resp) => {
      toast.success('Application submitted')
      qc.invalidateQueries({ queryKey: ['applications'] })
      if (resp?.id) navigate(`student/applications/${resp.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to apply')
    },
  })

  const loading = meQuery.isLoading || jobQuery.isLoading
  const loadErr = (jobQuery.error as Error) ?? (meQuery.error as Error)

  if (loading) return <JobDetailSkeleton />
  if (loadErr) {
    return (
      <ErrorState
        message={loadErr.message ?? 'Failed to load job'}
        onRetry={() => { jobQuery.refetch(); meQuery.refetch() }}
      />
    )
  }
  if (!jobQuery.data) {
    return <ErrorState message="Job not found" onRetry={() => jobQuery.refetch()} />
  }

  const job = jobQuery.data
  const match = matchQuery.data
  const requiredSkills = job.requirements.filter(r => r.isRequired)
  const preferredSkills = job.requirements.filter(r => !r.isRequired)

  return (
    <div className="space-y-6">
      <PageHeader title={job.title} description={`${job.company.name}${job.company.industry ? ` · ${job.company.industry}` : ''}`}>
        <Button variant="outline" size="sm" onClick={() => navigate('student/jobs')}>
          <ArrowLeft className="size-4 mr-1" /> Back to jobs
        </Button>
      </PageHeader>

      {/* Job header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                {job.workArrangement && (
                  <Badge variant="outline" className="capitalize">{job.workArrangement}</Badge>
                )}
                {job.employmentType && (
                  <Badge variant="outline" className="capitalize">{job.employmentType}</Badge>
                )}
                {job.location && (
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900">
                    <MapPin className="size-3 mr-1" /> {job.location}
                  </Badge>
                )}
                <Badge variant="secondary" className="capitalize">{job.sourceType}</Badge>
                {job.batchEligible && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900">
                    Batch {job.batchEligible}
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Salary</div>
                  <div className="font-medium">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency ?? 'INR')}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Posted</div>
                  <div className="font-medium">{formatDate(job.postingDate)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Closing</div>
                  <div className="font-medium">{formatDate(job.closingDate)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-slate-500">Experience</div>
                  <div className="font-medium">
                    {job.minExperience ?? job.maxExperience
                      ? `${job.minExperience ?? 0}–${job.maxExperience ?? '?'} yrs`
                      : 'Any'}
                  </div>
                </div>
              </div>
              {job.eligibilityCriteria && (
                <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-md p-3">
                  <span className="font-medium">Eligibility:</span> {job.eligibilityCriteria}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <Button onClick={() => applyMutation.mutate()} disabled={applyMutation.isPending}>
                <Send className="size-4 mr-2" />
                {applyMutation.isPending ? 'Applying…' : 'Apply now'}
              </Button>
              <Button variant="outline" onClick={() => generateResumeMutation.mutate()} disabled={generateResumeMutation.isPending}>
                <FileText className="size-4 mr-2" />
                {generateResumeMutation.isPending ? 'Generating…' : 'Generate resume'}
              </Button>
              {job.applicationUrl && (
                <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" className="w-full">
                    <ExternalLink className="size-4 mr-2" /> External link
                  </Button>
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: description + skills */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                {job.description}
              </p>
            </CardContent>
          </Card>

          {requiredSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Required skills
                  <Badge variant="outline" className="text-xs">{requiredSkills.length}</Badge>
                </CardTitle>
                <CardDescription>You must demonstrate these to be eligible</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {requiredSkills.slice(0, 20).map(s => (
                    <SkillTag key={s.id} name={s.name} isRequired={s.isRequired} />
                  ))}
                  {requiredSkills.length > 20 && (
                    <Badge variant="secondary" className="text-xs">
                      +{requiredSkills.length - 20} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {preferredSkills.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="size-4" /> Preferred skills
                  <Badge variant="outline" className="text-xs">{preferredSkills.length}</Badge>
                </CardTitle>
                <CardDescription>Nice-to-haves that boost your fit score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {preferredSkills.slice(0, 20).map(s => (
                    <SkillTag key={s.id} name={s.name} />
                  ))}
                  {preferredSkills.length > 20 && (
                    <Badge variant="secondary" className="text-xs">
                      +{preferredSkills.length - 20} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: fit analysis */}
        <div className="space-y-6">
          {matchQuery.isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-24 mx-auto" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ) : matchQuery.isError ? (
            <Card>
              <CardContent className="p-6">
                <EmptyState
                  icon={Target}
                  title="Fit analysis unavailable"
                  description="Could not compute match for this role"
                />
              </CardContent>
            </Card>
          ) : match ? (
            <FitAnalysis match={match} />
          ) : null}

          {match && match.breakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Skill-by-skill breakdown</CardTitle>
                <CardDescription>How each required skill contributes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Skill</TableHead>
                      <TableHead className="text-xs text-right">Weight</TableHead>
                      <TableHead className="text-xs">Match</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {match.breakdown.map((b) => (
                      <TableRow key={b.skillId}>
                        <TableCell className="text-xs py-2">
                          <div className="font-medium">{b.displayName}</div>
                          {b.isRequired && (
                            <span className="text-rose-500 text-[10px]">Required</span>
                          )}
                          {b.bestEvidence && (
                            <a
                              href="#"
                              onClick={(e) => { e.preventDefault(); }}
                              className="text-[10px] text-slate-500 hover:underline"
                              title={b.bestEvidence.title}
                            >
                              {b.bestEvidence.title}
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{b.weight}</TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <Progress value={b.matchValue * 100} className="h-1.5 w-16" />
                            <span className="text-xs tabular-nums">{Math.round(b.matchValue * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {b.matchValue >= 1 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="size-3" /> Verified
                            </span>
                          ) : b.matchValue > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Partial
                            </span>
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Missing
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Matching + Missing skills sections */}
      {match && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" /> Matching skills
                <Badge variant="outline" className="text-xs">{match.matchingSkills.length}</Badge>
              </CardTitle>
              <CardDescription>Skills you have evidence for</CardDescription>
            </CardHeader>
            <CardContent>
              {match.matchingSkills.length === 0 ? (
                <p className="text-sm text-slate-500">None of the required skills are currently matched.</p>
              ) : (
                <ul className="space-y-2">
                  {match.matchingSkills.map((m) => (
                    <li key={m.skillId} className="flex items-center justify-between gap-2 text-sm">
                      <SkillTag name={m.name} isVerified />
                      <Badge variant="outline" className="text-xs">
                        {m.evidenceIds.length} evidence
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-600" /> Missing skills
                <Badge variant="outline" className="text-xs">{match.missingSkills.length}</Badge>
              </CardTitle>
              <CardDescription>Gaps you should close before applying</CardDescription>
            </CardHeader>
            <CardContent>
              {match.missingSkills.length === 0 ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded p-3">
                  <ShieldCheck className="size-4 inline mr-1" />
                  No gaps — you cover every required and preferred skill!
                </p>
              ) : (
                <ul className="space-y-2">
                  {match.missingSkills.map((m) => (
                    <li
                      key={m.skillId}
                      className={cn(
                        'flex items-center justify-between gap-2 text-sm rounded border px-3 py-2',
                        m.isRequired
                          ? 'border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900'
                          : 'border-slate-200 bg-slate-50 dark:bg-slate-900'
                      )}
                    >
                      <span className="font-medium">{m.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {m.isRequired ? 'Required' : 'Preferred'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {m.status.replace(/_/g, ' ').toLowerCase()}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function FitAnalysis({ match }: { match: MatchData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4" /> Fit analysis
        </CardTitle>
        <CardDescription>Live computed match score</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big fit score */}
        <div className="flex flex-col items-center text-center py-4">
          <div className={cn(
            'text-5xl font-bold tabular-nums',
            match.fitScore >= 75 ? 'text-emerald-600 dark:text-emerald-400'
            : match.fitScore >= 50 ? 'text-amber-600 dark:text-amber-400'
            : match.fitScore >= 25 ? 'text-orange-600 dark:text-orange-400'
            : 'text-rose-600 dark:text-rose-400'
          )}>
            {match.fitScore.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">fit score</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Required coverage</div>
            <CoverageBadge value={match.requiredCoverage} />
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">Preferred coverage</div>
            <CoverageBadge value={match.preferredCoverage} />
          </div>
        </div>
        {match.factorsSummary && (
          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-md p-3">
            <Lightbulb className="size-3.5 inline mr-1" />
            {match.factorsSummary}
          </div>
        )}
        {match.recommendation && (
          <div className={cn(
            'text-xs rounded-md p-3 border',
            match.fitScore >= 50
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
          )}>
            <span className="font-medium">Recommendation:</span> {match.recommendation}
          </div>
        )}
        <div className="text-xs text-slate-400 pt-1 border-t flex items-center justify-between">
          <span>Algorithm v{match.algorithmVersion}</span>
          {match.storedAt && <span>Last computed {formatDate(match.storedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function JobDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading job…" description="Hang tight" />
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-24 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
