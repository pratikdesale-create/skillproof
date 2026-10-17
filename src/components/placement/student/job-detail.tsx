'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  SectionHeader, formatSalary, formatDate,
} from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowLeft, Building2, MapPin, Calendar, ExternalLink, FileText, Send,
  CheckCircle2, AlertTriangle, Target, Lightbulb, Layers, ShieldCheck,
  Globe, Briefcase, ListChecks, ChevronDown, ChevronRight, Link2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AuthUser, StudentProfile } from '@/types'

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

// Parse free-form job description into a list of responsibilities / bullets.
// Looks for bullet markers (-, •, *, numbered "1.") and newlines.
function parseResponsibilities(description: string): string[] {
  if (!description) return []
  const lines = description
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  const bullets: string[] = []
  for (const line of lines) {
    // Strip leading bullet chars + numbers
    const cleaned = line.replace(/^(\s*[-•*]\s+|\s*\d+[\.\)]\s+)/, '').trim()
    // Only keep short-ish standalone bullets (avoid narrative paragraphs)
    if (cleaned && cleaned.length > 8 && cleaned.length < 240 && /^[-•*\d]/.test(line)) {
      bullets.push(cleaned)
    }
  }
  return bullets.slice(0, 12)
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

  const generateResumeMutation = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/resumes/generate', { jobId: id }),
    onSuccess: (resp) => {
      toast.success('Resume generated for this role')
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
  const responsibilities = parseResponsibilities(job.description)

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={`${job.company.name}${job.company.industry ? ` · ${job.company.industry}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('student/jobs')}>
          <ArrowLeft className="size-4 mr-1" /> Back to jobs
        </Button>
      </PageHeader>

      {/* Job header / overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                {job.workArrangement && (
                  <Badge variant="outline" className="capitalize">{job.workArrangement}</Badge>
                )}
                {job.employmentType && (
                  <Badge variant="outline" className="capitalize">{job.employmentType}</Badge>
                )}
                {job.location && (
                  <Badge variant="outline">
                    <MapPin className="size-3 mr-1" /> {job.location}
                  </Badge>
                )}
                <Badge variant="secondary" className="capitalize">{job.sourceType}</Badge>
                {job.batchEligible && (
                  <Badge variant="outline">Batch {job.batchEligible}</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Salary</div>
                  <div className="font-medium">{formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency ?? 'INR')}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Posted</div>
                  <div className="font-medium">{formatDate(job.postingDate)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Closing</div>
                  <div className="font-medium">{formatDate(job.closingDate)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Experience</div>
                  <div className="font-medium">
                    {job.minExperience ?? job.maxExperience
                      ? `${job.minExperience ?? 0}–${job.maxExperience ?? '?'} yrs`
                      : 'Any'}
                  </div>
                </div>
              </div>
              {job.eligibilityCriteria && (
                <p className="text-sm text-muted-foreground bg-muted/40 rounded-md p-3 border">
                  <span className="font-medium text-foreground">Eligibility:</span> {job.eligibilityCriteria}
                </p>
              )}
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 lg:w-48">
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

      {/* Match summary panel — distinct, prominent */}
      {matchQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-16 w-24 mx-auto" />
            <Skeleton className="h-3 w-full" />
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
        <MatchSummaryPanel match={match} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: description, responsibilities, skills, application instructions */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {job.description}
              </p>
            </CardContent>
          </Card>

          {responsibilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="size-4" /> Responsibilities
                </CardTitle>
                <CardDescription>What you'll do (parsed from job description)</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {responsibilities.map((r, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-relaxed pl-4 relative">
                      <span className="absolute left-0 top-2 size-1 rounded-full bg-muted-foreground/60" />
                      {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

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
                  {requiredSkills.map(s => (
                    <SkillTag key={s.id} name={s.name} isRequired={s.isRequired} />
                  ))}
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
                  {preferredSkills.map(s => (
                    <SkillTag key={s.id} name={s.name} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="size-4" /> Application instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Apply via</span>
                <span className="font-medium">Skillproof (1-click apply)</span>
              </div>
              {job.applicationUrl && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">External portal</span>
                  <a
                    href={job.applicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    <Link2 className="size-3" /> Open external
                  </a>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Closing date</span>
                <span className="font-medium">{formatDate(job.closingDate)}</span>
              </div>
              {job.batchEligible && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Eligible batches</span>
                  <span className="font-medium">{job.batchEligible}</span>
                </div>
              )}
              {job.eligibilityCriteria && (
                <div className="pt-2 border-t">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Criteria</div>
                  <p className="text-foreground/90">{job.eligibilityCriteria}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: company info + skill breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4" /> Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium">{job.company.name}</div>
              {job.company.industry && (
                <div className="text-muted-foreground">{job.company.industry}</div>
              )}
              {job.company.website && (
                <a
                  href={job.company.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  <Globe className="size-3" /> Company website
                </a>
              )}
            </CardContent>
          </Card>

          {match && match.breakdown.length > 0 && (
            <SkillBreakdownCard match={match} />
          )}
        </div>
      </div>

      {/* Matching + Missing skills (kept, polished) */}
      {match && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[var(--verified-foreground)]" /> Matching skills
                <Badge variant="outline" className="text-xs">{match.matchingSkills.length}</Badge>
              </CardTitle>
              <CardDescription>Skills you have verified evidence for</CardDescription>
            </CardHeader>
            <CardContent>
              {match.matchingSkills.length === 0 ? (
                <p className="text-sm text-muted-foreground">None of the required skills are currently matched.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {match.matchingSkills.map((m) => (
                    <SkillTag key={m.skillId} name={m.name} isVerified />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="size-4 text-[var(--danger-foreground)]" /> Missing or insufficient skills
                <Badge variant="outline" className="text-xs">{match.missingSkills.length}</Badge>
              </CardTitle>
              <CardDescription>Gaps you should close before applying</CardDescription>
            </CardHeader>
            <CardContent>
              {match.missingSkills.length === 0 ? (
                <div className="text-sm text-[var(--verified-foreground)] bg-[var(--verified-muted)] border border-[var(--verified)]/30 rounded-md p-4">
                  <ShieldCheck className="size-4 inline mr-2" />
                  No gaps — you cover every required and preferred skill.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {match.missingSkills.map((m) => (
                    <SkillTag key={m.skillId} name={m.name} isRequired={m.isRequired} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function MatchSummaryPanel({ match }: { match: MatchData }) {
  const requiredMissing = match.missingSkills.filter(m => m.isRequired).length
  // Deterministic recommended next steps text
  const nextSteps: string[] = []
  if (requiredMissing === 0) {
    nextSteps.push('You meet every required skill — go ahead and apply.')
  } else {
    nextSteps.push(
      `Close ${requiredMissing} missing required skill${requiredMissing === 1 ? '' : 's'} by submitting verified evidence.`,
    )
  }
  if (match.preferredCoverage < 0.5) {
    nextSteps.push('Add preferred skills (e.g. projects, certifications) to lift your fit score further.')
  }
  if (match.fitScore < 50) {
    nextSteps.push('Generate a tailored resume for this role — your evidence-backed bullets will stand out.')
  }
  return (
    <Card className="bg-primary/[0.03] ring-1 ring-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="size-4" /> Match summary
          </CardTitle>
          <FitScoreBadge score={match.fitScore} size="lg" />
        </div>
        <CardDescription>Live computed fit score for your verified skills</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border bg-card p-3 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Required coverage</div>
            <CoverageBadge value={match.requiredCoverage} />
          </div>
          <div className="rounded-md border bg-card p-3 text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Preferred coverage</div>
            <CoverageBadge value={match.preferredCoverage} label="covered" />
          </div>
        </div>

        {match.factorsSummary && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3 border">
            <Lightbulb className="size-3.5 inline mr-1" />
            {match.factorsSummary}
          </div>
        )}

        {nextSteps.length > 0 && (
          <div className="rounded-md border border-[var(--info)]/30 bg-[var(--info-muted)] p-3">
            <div className="text-xs font-medium text-[var(--info-foreground)] mb-1.5 flex items-center gap-1.5">
              <Lightbulb className="size-3.5" /> Recommended next steps
            </div>
            <ul className="space-y-1">
              {nextSteps.map((s, i) => (
                <li key={i} className="text-xs text-[var(--info-foreground)] pl-3 relative">
                  <span className="absolute left-0">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t flex items-center justify-between">
          <span>Algorithm v{match.algorithmVersion}</span>
          {match.storedAt && <span>Last computed {formatDate(match.storedAt)}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function SkillBreakdownCard({ match }: { match: MatchData }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Skill-by-skill breakdown</CardTitle>
        <CardDescription>Click a skill to see why it contributed</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {match.breakdown.map((b) => {
            const isOpen = expanded === b.skillId
            const pct = Math.round(b.matchValue * 100)
            return (
              <li key={b.skillId} className="p-3">
                <button
                  className="w-full text-left"
                  onClick={() => setExpanded(isOpen ? null : b.skillId)}
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {isOpen ? <ChevronDown className="size-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
                      <SkillTag name={b.displayName} isRequired={b.isRequired} isVerified={b.matchValue >= 1} />
                      <span className="text-xs text-muted-foreground">w={b.weight}</span>
                    </div>
                    <span className={cn('text-xs font-semibold tabular-nums shrink-0',
                      b.matchValue >= 1 ? 'text-[var(--verified-foreground)]'
                      : b.matchValue > 0 ? 'text-[var(--pending-foreground)]'
                      : 'text-[var(--danger-foreground)]'
                    )}>
                      {pct}%
                    </span>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 pl-6 space-y-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">Why it contributed:</span>{' '}
                      {b.matchValue >= 1
                        ? 'Verified evidence supports this skill at full weight.'
                        : b.matchValue > 0
                        ? 'Pending evidence supports this skill at partial weight (0.25×).'
                        : 'No supporting evidence found for this skill.'}
                    </div>
                    {b.bestEvidence ? (
                      <div className="rounded-md border bg-muted/40 p-2">
                        <div className="text-muted-foreground">Best evidence</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <FileText className="size-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{b.bestEvidence.title}</span>
                          <Badge variant="outline" className="text-xs">{b.bestEvidence.type}</Badge>
                          <Badge variant="outline" className="text-xs">{b.bestEvidence.status.replace(/_/g, ' ').toLowerCase()}</Badge>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          Relevance: {Math.round(b.bestEvidence.relevance * 100)}% · {b.evidenceCount} evidence item{b.evidenceCount === 1 ? '' : 's'} linked
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--danger-muted)] p-2 text-[var(--danger-foreground)]">
                        <AlertTriangle className="size-3.5 inline mr-1" />
                        No linked evidence for this skill.
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
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
