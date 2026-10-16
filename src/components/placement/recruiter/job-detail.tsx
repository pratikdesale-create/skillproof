'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatSalary, formatDate, formatDateTime,
} from '@/components/placement/shared/ui'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, MapPin, Calendar, Building2, Users, Target, Briefcase, Layers, ShieldCheck, Pencil,
} from 'lucide-react'
import { JobForm, type JobFormValues } from './job-form'

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

interface MatchesResponse {
  data: unknown[]
  total: number
}
interface ApplicationsResponse {
  data: unknown[]
  total: number
}

function isoToDatetimeLocal(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function deriveInitialValues(job: JobDetail): Partial<JobFormValues> {
  const required = job.requirements.filter(r => r.isRequired).map(r => r.name).join(', ')
  const preferred = job.requirements.filter(r => !r.isRequired).map(r => r.name).join(', ')
  return {
    title: job.title,
    description: job.description,
    location: job.location ?? '',
    workArrangement: job.workArrangement ?? '',
    employmentType: job.employmentType ?? '',
    minExperience: job.minExperience != null ? String(job.minExperience) : '',
    maxExperience: job.maxExperience != null ? String(job.maxExperience) : '',
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    batchEligible: job.batchEligible ?? '',
    eligibilityCriteria: job.eligibilityCriteria ?? '',
    sourceType: job.sourceType ?? 'MANUAL',
    requiredSkills: required,
    preferredSkills: preferred,
    closingDate: isoToDatetimeLocal(job.closingDate),
  }
}

export function JobDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const [editOpen, setEditOpen] = useState(false)

  const jobQuery = useQuery<JobDetail>({
    queryKey: ['job', id],
    queryFn: () => apiGet<JobDetail>(`/api/jobs/${id}`),
    staleTime: 60_000,
  })

  // Matches count (recruiter owns the job's company, so this route is allowed)
  const matchesQuery = useQuery<MatchesResponse>({
    queryKey: ['job-matches-count', id],
    queryFn: () => apiGet<MatchesResponse>(`/api/matches/job/${id}?take=1`),
    staleTime: 30_000,
  })

  // Applications count for this job (the applications route auto-filters by recruiter's company)
  const appsQuery = useQuery<ApplicationsResponse>({
    queryKey: ['job-applications-count', id],
    queryFn: () => apiGet<ApplicationsResponse>(`/api/applications?jobId=${id}`),
    staleTime: 30_000,
  })

  const loading = jobQuery.isLoading
  const loadErr = jobQuery.error as Error | null

  if (loading) return <JobDetailSkeleton />
  if (loadErr) {
    return (
      <ErrorState
        message={loadErr.message ?? 'Failed to load job'}
        onRetry={() => jobQuery.refetch()}
      />
    )
  }
  if (!jobQuery.data) {
    return <ErrorState message="Job not found" onRetry={() => jobQuery.refetch()} />
  }

  const job = jobQuery.data
  const requiredSkills = job.requirements.filter(r => r.isRequired)
  const preferredSkills = job.requirements.filter(r => !r.isRequired)
  const matchesCount = matchesQuery.data?.total ?? 0
  const appsCount = appsQuery.data?.total ?? 0

  const initialValues = deriveInitialValues(job)

  return (
    <div className="space-y-6">
      <PageHeader
        title={job.title}
        description={`${job.company.name}${job.company.industry ? ` · ${job.company.industry}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('recruiter/jobs')}>
          <ArrowLeft className="size-4 mr-1" /> All jobs
        </Button>
        <Button size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="size-4 mr-1" /> Edit
        </Button>
      </PageHeader>

      {/* Job header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={job.status === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300'
                }>
                  {job.status}
                </Badge>
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
              {job.applicationUrl && (
                <a
                  href={job.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-slate-700 dark:text-slate-300 hover:underline"
                >
                  External application URL ↗
                </a>
              )}
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
              <Button onClick={() => navigate('recruiter/shortlist', { jobId: job.id })}>
                <Users className="size-4 mr-2" /> View candidates
              </Button>
              <Button variant="outline" onClick={() => navigate('recruiter/applications', { jobId: job.id })}>
                <Briefcase className="size-4 mr-2" /> View applications
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Count summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Candidates ranked</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {matchesQuery.isLoading ? <Skeleton className="h-8 w-12" /> : matchesCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">Across all students</div>
            </div>
            <Target className="size-8 text-slate-400" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Applications received</div>
              <div className="text-2xl font-bold tabular-nums mt-1">
                {appsQuery.isLoading ? <Skeleton className="h-8 w-12" /> : appsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">Applied to this role</div>
            </div>
            <Users className="size-8 text-slate-400" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
              <CardDescription>Last updated {formatDateTime(job.updatedAt)}</CardDescription>
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
                <CardDescription>Weighted heavily in fit scoring</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {requiredSkills.map(s => (
                    <SkillTag key={s.id} name={s.name} isRequired />
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
                <CardDescription>Nice-to-haves that boost candidate fit scores</CardDescription>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4" /> Company
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-500">Name</div>
                <div className="font-medium">{job.company.name}</div>
              </div>
              {job.company.industry && (
                <div>
                  <div className="text-xs text-slate-500">Industry</div>
                  <div className="font-medium">{job.company.industry}</div>
                </div>
              )}
              {job.company.website && (
                <div>
                  <div className="text-xs text-slate-500">Website</div>
                  <a
                    href={job.company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-700 dark:text-slate-300 hover:underline"
                  >
                    {job.company.website} ↗
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4" /> Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-500">Posted</div>
                <div className="font-medium">{formatDate(job.postingDate)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Closing</div>
                <div className="font-medium">{formatDate(job.closingDate)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Created</div>
                <div className="font-medium">{formatDateTime(job.createdAt)}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit job posting</DialogTitle>
            <DialogDescription>
              {job.title} — changes to required/preferred skills will re-run duplicate detection and clear cached match results.
            </DialogDescription>
          </DialogHeader>
          <JobForm
            mode="edit"
            jobId={job.id}
            initialValues={initialValues}
            onSaved={() => setEditOpen(false)}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
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
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-24 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
