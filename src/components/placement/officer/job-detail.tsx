'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  formatSalary, formatDate,
} from '@/components/placement/shared/ui'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, MapPin, Calendar, ExternalLink, Building2, Target,
  Pencil, Archive, RefreshCw, ListOrdered, Loader2, Briefcase,
} from 'lucide-react'
import { toast } from 'sonner'

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
  sourceUrl?: string | null
  externalId?: string | null
  eligibilityCriteria?: string | null
  batchEligible?: string | null
  createdAt: string
  updatedAt: string
  requirements: JobRequirement[]
}

const WORK_ARRANGEMENTS = ['remote', 'hybrid', 'onsite']
const EMPLOYMENT_TYPES = ['full-time', 'internship', 'contract']

export function JobDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery<JobDetail>({
    queryKey: ['job', id],
    queryFn: () => apiGet<JobDetail>(`/api/jobs/${id}`),
    staleTime: 30_000,
  })

  const [showEdit, setShowEdit] = useState(false)

  const archiveMutation = useMutation({
    mutationFn: () => apiPatch(`/api/jobs/${id}`, { status: 'ARCHIVED' }),
    onSuccess: () => {
      toast.success('Job archived')
      qc.invalidateQueries({ queryKey: ['job', id] })
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to archive job')
    },
  })

  const recomputeMutation = useMutation({
    mutationFn: () => apiPost<{ computed: number }>(`/api/matches/recompute/${id}`),
    onSuccess: (resp) => {
      toast.success(`Recomputed ${resp.computed} matches for this job`)
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
      qc.invalidateQueries({ queryKey: ['job-matches', id] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to recompute')
    },
  })

  if (isLoading) return <JobDetailSkeleton />
  if (isError) {
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load job'} onRetry={() => refetch()} />
  }
  if (!data) return <ErrorState message="Job not found" onRetry={() => refetch()} />

  const requiredSkills = data.requirements.filter((r) => r.isRequired)
  const preferredSkills = data.requirements.filter((r) => !r.isRequired)

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`${data.company.name}${data.company.industry ? ` · ${data.company.industry}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('officer/jobs')}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
          <Pencil className="size-4 mr-1" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('officer/ranking', { jobId: data.id })}
        >
          <ListOrdered className="size-4 mr-1" /> Batch ranking
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => recomputeMutation.mutate()}
          disabled={recomputeMutation.isPending}
        >
          {recomputeMutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <RefreshCw className="size-4 mr-1" />}
          Recompute matches
        </Button>
        {data.status !== 'ARCHIVED' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950"
              >
                <Archive className="size-4 mr-1" /> Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this job?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will hide it from students and stop new applications. Existing applications are preserved. You can restore by editing the status.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {archiveMutation.isPending ? 'Archiving…' : 'Archive job'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-6">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={
                  data.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                  data.status === 'CLOSED' ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300' :
                  data.status === 'ARCHIVED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                }>
                  {data.status}
                </Badge>
                {data.workArrangement && <Badge variant="outline" className="capitalize">{data.workArrangement}</Badge>}
                {data.employmentType && <Badge variant="outline" className="capitalize">{data.employmentType}</Badge>}
                {data.location && (
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900">
                    <MapPin className="size-3 mr-1" /> {data.location}
                  </Badge>
                )}
                <Badge variant="secondary" className="capitalize">{data.sourceType}</Badge>
                {data.batchEligible && (
                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900">
                    Batch {data.batchEligible}
                  </Badge>
                )}
              </div>

              <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {data.description}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
                {data.salaryMin || data.salaryMax ? (
                  <Meta label="Salary" value={formatSalary(data.salaryMin, data.salaryMax, data.salaryCurrency ?? 'INR')} />
                ) : null}
                {(data.minExperience != null || data.maxExperience != null) && (
                  <Meta label="Experience" value={
                    data.minExperience != null && data.maxExperience != null
                      ? `${data.minExperience}–${data.maxExperience} yrs`
                      : `${data.minExperience ?? data.maxExperience}+ yrs`
                  } />
                )}
                <Meta label="Posted" value={formatDate(data.postingDate)} />
                {data.closingDate && <Meta label="Closes" value={formatDate(data.closingDate)} />}
              </div>

              {data.eligibilityCriteria && (
                <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
                  <span className="font-medium">Eligibility:</span> {data.eligibilityCriteria}
                </div>
              )}

              {(data.applicationUrl || data.sourceUrl || data.externalId) && (
                <div className="flex flex-wrap gap-3 text-sm pt-2 border-t">
                  {data.applicationUrl && (
                    <a href={data.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline">
                      <ExternalLink className="size-3.5" /> Application URL
                    </a>
                  )}
                  {data.sourceUrl && (
                    <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 hover:underline">
                      <ExternalLink className="size-3.5" /> Source URL
                    </a>
                  )}
                  {data.externalId && <span className="text-slate-500">External ID: {data.externalId}</span>}
                </div>
              )}
            </div>

            <div className="lg:w-64 space-y-3">
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs uppercase tracking-wider text-slate-500">Company</div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="size-4 text-slate-400" />
                  {data.company.name}
                </div>
                {data.company.industry && (
                  <div className="text-xs text-slate-500">{data.company.industry}</div>
                )}
                {data.company.website && (
                  <a href={data.company.website} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-600 dark:text-slate-400 hover:underline inline-flex items-center gap-1">
                    <ExternalLink className="size-3" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4" /> Required skills
              <Badge variant="secondary" className="ml-auto text-xs">{requiredSkills.length}</Badge>
            </CardTitle>
            <CardDescription>Must-have skills (weight 4)</CardDescription>
          </CardHeader>
          <CardContent>
            {requiredSkills.length === 0 ? (
              <EmptyState icon={Target} title="No required skills" description="This job has no required skills set" />
            ) : (
              <ul className="space-y-2">
                {requiredSkills.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                    <SkillTag name={r.name} isRequired size="sm" />
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      {r.category && <span>{r.category}</span>}
                      <span>weight: {r.weight}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="size-4" /> Preferred skills
              <Badge variant="secondary" className="ml-auto text-xs">{preferredSkills.length}</Badge>
            </CardTitle>
            <CardDescription>Nice-to-have skills (weight 1)</CardDescription>
          </CardHeader>
          <CardContent>
            {preferredSkills.length === 0 ? (
              <EmptyState icon={Briefcase} title="No preferred skills" description="This job has no preferred skills set" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {preferredSkills.map((r) => (
                  <SkillTag key={r.id} name={r.name} size="sm" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <EditJobDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        job={data}
      />
    </div>
  )
}

function EditJobDialog({
  open, onOpenChange, job,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: JobDetail
}) {
  const qc = useQueryClient()
  const [title, setTitle] = useState(job.title)
  const [description, setDescription] = useState(job.description)
  const [location, setLocation] = useState(job.location ?? '')
  const [workArrangement, setWorkArrangement] = useState(job.workArrangement ?? '')
  const [employmentType, setEmploymentType] = useState(job.employmentType ?? '')
  const [salaryMin, setSalaryMin] = useState<string>(job.salaryMin != null ? String(job.salaryMin) : '')
  const [salaryMax, setSalaryMax] = useState<string>(job.salaryMax != null ? String(job.salaryMax) : '')
  const [batchEligible, setBatchEligible] = useState(job.batchEligible ?? '')
  const [eligibilityCriteria, setEligibilityCriteria] = useState(job.eligibilityCriteria ?? '')
  const [requiredSkillsInput, setRequiredSkillsInput] = useState(
    job.requirements.filter((r) => r.isRequired).map((r) => r.name).join(', ')
  )
  const [preferredSkillsInput, setPreferredSkillsInput] = useState(
    job.requirements.filter((r) => !r.isRequired).map((r) => r.name).join(', ')
  )

  // Reset state when dialog opens (so reopened edits show latest)
  // Using key prop on parent is cleaner but state hooks are fine here.

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch(`/api/jobs/${job.id}`, body),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['job', job.id] })
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
      onOpenChange(false)
      if (resp && typeof resp === 'object' && 'skillsChanged' in resp && (resp as { skillsChanged: boolean }).skillsChanged) {
        toast.success('Job updated — skills changed; matches will be recomputed')
      } else {
        toast.success('Job updated')
      }
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to update job')
    },
  })

  function submit() {
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required')
      return
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
    }
    if (location !== (job.location ?? '')) body.location = location || ''
    if (workArrangement !== (job.workArrangement ?? '')) body.workArrangement = (workArrangement || undefined) as 'remote' | 'hybrid' | 'onsite' | undefined
    if (employmentType !== (job.employmentType ?? '')) body.employmentType = (employmentType || undefined) as 'full-time' | 'internship' | 'contract' | undefined
    if (salaryMin !== (job.salaryMin != null ? String(job.salaryMin) : '')) body.salaryMin = salaryMin ? Number(salaryMin) : undefined
    if (salaryMax !== (job.salaryMax != null ? String(job.salaryMax) : '')) body.salaryMax = salaryMax ? Number(salaryMax) : undefined
    if (batchEligible !== (job.batchEligible ?? '')) body.batchEligible = batchEligible
    if (eligibilityCriteria !== (job.eligibilityCriteria ?? '')) body.eligibilityCriteria = eligibilityCriteria
    // Always re-send skills (normalization handles unchanged)
    body.requiredSkills = requiredSkillsInput.split(',').map((s) => s.trim()).filter(Boolean)
    body.preferredSkills = preferredSkillsInput.split(',').map((s) => s.trim()).filter(Boolean)
    mutation.mutate(body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit job</DialogTitle>
          <DialogDescription>Changes to skills will trigger duplicate re-detection and clear cached match results.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-slate-500">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-slate-500">Description *</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Work arrangement</Label>
            <Select value={workArrangement || 'NONE'} onValueChange={(v) => setWorkArrangement(v === 'NONE' ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {WORK_ARRANGEMENTS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Employment type</Label>
            <Select value={employmentType || 'NONE'} onValueChange={(v) => setEmploymentType(v === 'NONE' ? '' : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Salary min</Label>
            <Input type="number" min={0} value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Salary max</Label>
            <Input type="number" min={0} value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Batch eligible</Label>
            <Input value={batchEligible} onChange={(e) => setBatchEligible(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Eligibility criteria</Label>
            <Input value={eligibilityCriteria} onChange={(e) => setEligibilityCriteria(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-slate-500">Required skills (comma-separated)</Label>
            <Input value={requiredSkillsInput} onChange={(e) => setRequiredSkillsInput(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-slate-500">Preferred skills (comma-separated)</Label>
            <Input value={preferredSkillsInput} onChange={(e) => setPreferredSkillsInput(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  )
}

function JobDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading job…" description="Hang tight" />
      <CardSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
