'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiPost, apiPatch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export interface JobFormValues {
  title: string
  description: string
  location: string
  workArrangement: string
  employmentType: string
  minExperience: string
  maxExperience: string
  salaryMin: string
  salaryMax: string
  batchEligible: string
  eligibilityCriteria: string
  sourceType: string
  requiredSkills: string
  preferredSkills: string
  closingDate: string
}

export const EMPTY_JOB_VALUES: JobFormValues = {
  title: '',
  description: '',
  location: '',
  workArrangement: '',
  employmentType: '',
  minExperience: '',
  maxExperience: '',
  salaryMin: '',
  salaryMax: '',
  batchEligible: '',
  eligibilityCriteria: '',
  sourceType: 'MANUAL',
  requiredSkills: '',
  preferredSkills: '',
  closingDate: '',
}

function toNumberOrNull(value: string): number | undefined {
  if (!value.trim()) return undefined
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

function buildPayload(values: JobFormValues, mode: 'create' | 'edit') {
  const body: Record<string, unknown> = {
    title: values.title.trim(),
    description: values.description.trim(),
    location: values.location.trim() || undefined,
    workArrangement: values.workArrangement || undefined,
    employmentType: values.employmentType || undefined,
    minExperience: toNumberOrNull(values.minExperience),
    maxExperience: toNumberOrNull(values.maxExperience),
    salaryMin: toNumberOrNull(values.salaryMin),
    salaryMax: toNumberOrNull(values.salaryMax),
    batchEligible: values.batchEligible.trim() || undefined,
    eligibilityCriteria: values.eligibilityCriteria.trim() || undefined,
    sourceType: values.sourceType || 'MANUAL',
    requiredSkills: values.requiredSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
    preferredSkills: values.preferredSkills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  }
  if (values.closingDate) {
    // Convert datetime-local to ISO string
    const d = new Date(values.closingDate)
    if (!isNaN(d.getTime())) body.closingDate = d.toISOString()
  }
  if (mode === 'create') {
    // For create, the caller will add companyId
  }
  // Remove undefined fields so PATCH only sends what's needed
  Object.keys(body).forEach(k => body[k] === undefined && delete body[k])
  return body
}

interface JobFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<JobFormValues>
  companyId?: string
  jobId?: string
  onSaved: (response: unknown) => void
  onCancel: () => void
}

export function JobForm({
  mode, initialValues, companyId, jobId, onSaved, onCancel,
}: JobFormProps) {
  const qc = useQueryClient()
  const [values, setValues] = useState<JobFormValues>(() => ({
    ...EMPTY_JOB_VALUES,
    ...(initialValues ?? {}),
  }))

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(values, mode)
      if (mode === 'create') {
        if (!companyId) throw new Error('No company bound to your recruiter profile')
        return apiPost('/api/jobs', { ...payload, companyId })
      } else {
        if (!jobId) throw new Error('Missing job id')
        return apiPatch(`/api/jobs/${jobId}`, payload)
      }
    },
    onSuccess: (resp) => {
      const r = resp as { id?: string; duplicates?: Array<{ similarity: number; reasons: string[] }> }
      if (mode === 'create') {
        toast.success('Job created successfully')
      } else {
        toast.success('Job updated')
      }
      // Surface duplicate detection warning if any
      if (r.duplicates && r.duplicates.length > 0) {
        const dup = r.duplicates[0]
        toast.warning(`Possible duplicate detected (${(dup.similarity * 100).toFixed(0)}% match): ${dup.reasons.join(', ')}`)
      }
      qc.invalidateQueries({ queryKey: ['recruiter-jobs'] })
      qc.invalidateQueries({ queryKey: ['recruiter-dashboard'] })
      if (mode === 'edit' && jobId) {
        qc.invalidateQueries({ queryKey: ['job', jobId] })
      }
      onSaved(resp)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? `Failed to ${mode === 'create' ? 'create' : 'update'} job`)
    },
  })

  function set<K extends keyof JobFormValues>(key: K, val: JobFormValues[K]) {
    setValues(prev => ({ ...prev, [key]: val }))
  }

  const submitDisabled =
    mutation.isPending || !values.title.trim() || !values.description.trim()

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label htmlFor="job-title">Title *</Label>
        <Input
          id="job-title"
          value={values.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Backend Engineer"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-desc">Description *</Label>
        <Textarea
          id="job-desc"
          rows={5}
          value={values.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Role summary, responsibilities, must-haves…"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="job-loc">Location</Label>
          <Input
            id="job-loc"
            value={values.location}
            onChange={e => set('location', e.target.value)}
            placeholder="e.g. Bengaluru"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-batch">Batch eligible</Label>
          <Input
            id="job-batch"
            value={values.batchEligible}
            onChange={e => set('batchEligible', e.target.value)}
            placeholder="e.g. 2025"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Work arrangement</Label>
          <Select
            value={values.workArrangement || 'any'}
            onValueChange={v => set('workArrangement', v === 'any' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Employment type</Label>
          <Select
            value={values.employmentType || 'any'}
            onValueChange={v => set('employmentType', v === 'any' ? '' : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="full-time">Full-time</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="job-min-exp">Min exp. (yrs)</Label>
          <Input
            id="job-min-exp"
            type="number"
            min={0}
            value={values.minExperience}
            onChange={e => set('minExperience', e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-max-exp">Max exp. (yrs)</Label>
          <Input
            id="job-max-exp"
            type="number"
            min={0}
            value={values.maxExperience}
            onChange={e => set('maxExperience', e.target.value)}
            placeholder="5"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-sal-min">Salary min (₹)</Label>
          <Input
            id="job-sal-min"
            type="number"
            min={0}
            value={values.salaryMin}
            onChange={e => set('salaryMin', e.target.value)}
            placeholder="500000"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-sal-max">Salary max (₹)</Label>
          <Input
            id="job-sal-max"
            type="number"
            min={0}
            value={values.salaryMax}
            onChange={e => set('salaryMax', e.target.value)}
            placeholder="1200000"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-closing">Closing date</Label>
        <Input
          id="job-closing"
          type="datetime-local"
          value={values.closingDate}
          onChange={e => set('closingDate', e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-elig">Eligibility criteria</Label>
        <Textarea
          id="job-elig"
          rows={2}
          value={values.eligibilityCriteria}
          onChange={e => set('eligibilityCriteria', e.target.value)}
          placeholder="e.g. No active backlogs, 7+ CGPA"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-req-skills">Required skills (comma-separated)</Label>
        <Input
          id="job-req-skills"
          value={values.requiredSkills}
          onChange={e => set('requiredSkills', e.target.value)}
          placeholder="e.g. Python, SQL, AWS"
        />
        <p className="text-xs text-muted-foreground">These are weighted heavily in fit scoring</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="job-pref-skills">Preferred skills (comma-separated)</Label>
        <Input
          id="job-pref-skills"
          value={values.preferredSkills}
          onChange={e => set('preferredSkills', e.target.value)}
          placeholder="e.g. Docker, Kafka"
        />
        <p className="text-xs text-muted-foreground">Nice-to-haves; lower weight</p>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" onClick={onCancel} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={() => mutation.mutate()} disabled={submitDisabled}>
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              {mode === 'create' ? 'Creating…' : 'Saving…'}
            </>
          ) : (
            mode === 'create' ? 'Create job' : 'Save changes'
          )}
        </Button>
      </div>
    </div>
  )
}
