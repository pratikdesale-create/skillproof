'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState,
} from '@/components/placement/shared/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase, Search, Plus, Upload, ArrowRight, X, Loader2, Building2,
} from 'lucide-react'
import { toast } from 'sonner'

interface JobCompany { id: string; name: string; industry?: string | null }
interface JobListItem {
  id: string
  title: string
  companyId: string
  company: JobCompany
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  salaryMin?: number | null
  salaryMax?: number | null
  closingDate?: string | null
  batchEligible?: string | null
  sourceType: string
  postingDate: string
  status: string
  requiredSkillCount: number
  preferredSkillCount: number
}
interface JobsResponse { data: JobListItem[]; total: number; skip: number; take: number }

const WORK_ARRANGEMENTS = ['remote', 'hybrid', 'onsite']
const EMPLOYMENT_TYPES = ['full-time', 'internship', 'contract']
const SOURCE_TYPES = ['MANUAL', 'FEED', 'ALUMNI', 'API', 'CSV']
const STATUSES = ['OPEN', 'CLOSED', 'DRAFT', 'ARCHIVED']

export function JobsManagement() {
  const navigate = useAppStore(s => s.navigate)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('')
  const [company, setCompany] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('OPEN')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (batch) p.set('batch', batch)
    if (company) p.set('company', company)
    if (source) p.set('sourceType', source)
    if (status) p.set('status', status)
    p.set('skip', '0')
    p.set('take', '50')
    return `/api/jobs?${p.toString()}`
  }, [search, batch, company, source, status])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<JobsResponse>({
    queryKey: ['officer-jobs', url],
    queryFn: () => apiGet<JobsResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  // Use the same query for the company picker (extract distinct company names)
  const companiesUrl = '/api/jobs?skip=0&take=200'
  const companiesQuery = useQuery<JobsResponse>({
    queryKey: ['officer-jobs-for-companies', companiesUrl],
    queryFn: () => apiGet<JobsResponse>(companiesUrl),
    staleTime: 60_000,
  })
  const companyOptions = useMemo(() => {
    const map = new Map<string, JobCompany>()
    for (const j of companiesQuery.data?.data ?? []) {
      if (!map.has(j.companyId)) map.set(j.companyId, j.company)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [companiesQuery.data])

  const jobs = data?.data ?? []
  const total = data?.total ?? 0

  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  function clearFilters() {
    setSearchInput('')
    setBatch('')
    setCompany('')
    setSource('')
    setStatus('OPEN')
  }
  const anyFilter = Boolean(search || batch || company || source || status !== 'OPEN')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job Management"
        description={`${total} job${total === 1 ? '' : 's'} in the system`}
      >
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}>
          <Upload className="size-4 mr-1" /> Import CSV
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="size-4 mr-1" /> Create job
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5 lg:col-span-2">
              <Label className="text-xs text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="Title, company, description…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Batch</Label>
              <Input
                placeholder="e.g. 2025"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Company</Label>
              <Select value={company || 'ALL'} onValueChange={(v) => setCompany(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All companies" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All companies</SelectItem>
                  {companyOptions.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Source</Label>
              <Select value={source || 'ALL'} onValueChange={(v) => setSource(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All sources" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All sources</SelectItem>
                  {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  <SelectItem value="ALL">All statuses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4 mr-1" /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState message={(error as Error)?.message ?? 'Failed to load jobs'} onRetry={() => refetch()} />
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs found"
              description={anyFilter ? 'Try adjusting filters' : 'Create your first job to get started'}
              action={
                <Button size="sm" onClick={() => anyFilter ? clearFilters() : setShowCreate(true)}>
                  {anyFilter ? 'Clear filters' : <><Plus className="size-4 mr-1" /> Create job</>}
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Skills</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow
                    key={j.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`officer/jobs/${j.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm">{j.title}</div>
                      <div className="text-xs text-slate-500 md:hidden">{j.company.name}</div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <div className="flex items-center gap-1">
                        <Building2 className="size-3 text-slate-400" />
                        {j.company.name}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{j.location ?? '—'}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary" className="text-xs">{j.sourceType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{j.batchEligible ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        j.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300' :
                        j.status === 'CLOSED' ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300' :
                        j.status === 'ARCHIVED' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300' :
                        'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      }>
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      <span className="text-rose-600">{j.requiredSkillCount} req</span>
                      <span className="text-slate-400 mx-1">·</span>
                      <span className="text-slate-600 dark:text-slate-400">{j.preferredSkillCount} pref</span>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="size-4 text-slate-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {isFetching && jobs.length > 0 && (
            <div className="p-2 text-xs text-slate-500 text-center flex items-center justify-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Refreshing…
            </div>
          )}
        </CardContent>
      </Card>

      <CreateJobDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        companies={companyOptions}
        onCreated={(resp) => {
          if (resp.duplicates?.length > 0) {
            toast.warning(`Created "${resp.title}" — ${resp.duplicates.length} possible duplicate${resp.duplicates.length === 1 ? '' : 's'} flagged`)
            navigate('officer/duplicates')
          } else {
            toast.success(`Created "${resp.title}"`)
            navigate(`officer/jobs/${resp.id}`)
          }
        }}
      />

      <ImportCsvDialog open={showImport} onOpenChange={setShowImport} />
    </div>
  )
}

interface CreateJobPayload {
  title: string
  companyId: string
  description: string
  location?: string
  workArrangement?: string
  employmentType?: string
  minExperience?: number
  maxExperience?: number
  salaryMin?: number
  salaryMax?: number
  batchEligible?: string
  eligibilityCriteria?: string
  sourceType?: string
  sourceUrl?: string
  externalId?: string
  requiredSkills: string[]
  preferredSkills: string[]
}

function CreateJobDialog({
  open, onOpenChange, companies, onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companies: JobCompany[]
  onCreated: (resp: { id: string; title: string; duplicates: Array<{ id: string }> }) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<CreateJobPayload>({
    title: '', companyId: '', description: '',
    requiredSkills: [], preferredSkills: [],
  })
  const [requiredSkillsInput, setRequiredSkillsInput] = useState('')
  const [preferredSkillsInput, setPreferredSkillsInput] = useState('')

  function reset() {
    setForm({ title: '', companyId: '', description: '', requiredSkills: [], preferredSkills: [] })
    setRequiredSkillsInput('')
    setPreferredSkillsInput('')
  }

  const mutation = useMutation({
    mutationFn: (body: CreateJobPayload) => apiPost('/api/jobs', body),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
      onCreated(resp as { id: string; title: string; duplicates: Array<{ id: string }> })
      reset()
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to create job')
    },
  })

  function submit() {
    if (!form.title.trim() || !form.companyId || !form.description.trim()) {
      toast.error('Title, company, and description are required')
      return
    }
    const payload: CreateJobPayload = {
      ...form,
      requiredSkills: requiredSkillsInput.split(',').map((s) => s.trim()).filter(Boolean),
      preferredSkills: preferredSkillsInput.split(',').map((s) => s.trim()).filter(Boolean),
    }
    // Coerce empty strings to undefined — go through Record<string, unknown>
    const cleaned: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(payload)) {
      cleaned[k] = v === '' ? undefined : v
    }
    mutation.mutate(cleaned as unknown as CreateJobPayload)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create job</DialogTitle>
          <DialogDescription>Post a new job. Skills are auto-normalized.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
          <Field label="Title *" className="md:col-span-2">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Backend Engineer" />
          </Field>
          <Field label="Company *" className="md:col-span-2">
            {companies.length > 0 ? (
              <Select value={form.companyId} onValueChange={(v) => setForm({ ...form, companyId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose company" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} placeholder="Company ID (no companies yet)" />
            )}
          </Field>
          <Field label="Description *" className="md:col-span-2">
            <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Job description…" />
          </Field>
          <Field label="Location">
            <Input value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Bengaluru" />
          </Field>
          <Field label="Work arrangement">
            <Select value={form.workArrangement ?? 'NONE'} onValueChange={(v) => setForm({ ...form, workArrangement: v === 'NONE' ? undefined : v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {WORK_ARRANGEMENTS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employment type">
            <Select value={form.employmentType ?? 'NONE'} onValueChange={(v) => setForm({ ...form, employmentType: v === 'NONE' ? undefined : v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {EMPLOYMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Source type">
            <Select value={form.sourceType ?? 'MANUAL'} onValueChange={(v) => setForm({ ...form, sourceType: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Min experience (yrs)">
            <Input type="number" min={0} value={form.minExperience ?? ''} onChange={(e) => setForm({ ...form, minExperience: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Max experience (yrs)">
            <Input type="number" min={0} value={form.maxExperience ?? ''} onChange={(e) => setForm({ ...form, maxExperience: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Salary min">
            <Input type="number" min={0} value={form.salaryMin ?? ''} onChange={(e) => setForm({ ...form, salaryMin: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Salary max">
            <Input type="number" min={0} value={form.salaryMax ?? ''} onChange={(e) => setForm({ ...form, salaryMax: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Batch eligible">
            <Input value={form.batchEligible ?? ''} onChange={(e) => setForm({ ...form, batchEligible: e.target.value })} placeholder="e.g. 2025" />
          </Field>
          <Field label="Eligibility criteria">
            <Input value={form.eligibilityCriteria ?? ''} onChange={(e) => setForm({ ...form, eligibilityCriteria: e.target.value })} placeholder="e.g. CGPA >= 7.5" />
          </Field>
          <Field label="Source URL">
            <Input value={form.sourceUrl ?? ''} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="External ID">
            <Input value={form.externalId ?? ''} onChange={(e) => setForm({ ...form, externalId: e.target.value })} placeholder="External posting ID" />
          </Field>
          <Field label="Required skills (comma-separated)" className="md:col-span-2">
            <Input value={requiredSkillsInput} onChange={(e) => setRequiredSkillsInput(e.target.value)} placeholder="e.g. Python, SQL, AWS" />
          </Field>
          <Field label="Preferred skills (comma-separated)" className="md:col-span-2">
            <Input value={preferredSkillsInput} onChange={(e) => setPreferredSkillsInput(e.target.value)} placeholder="e.g. Docker, Kubernetes" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            Create job
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportCsvDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient()
  const [csv, setCsv] = useState('')
  const [result, setResult] = useState<{ imported: number; errors: Array<{ row: number; message: string }>; totalRows: number } | null>(null)

  function reset() { setCsv(''); setResult(null) }

  const mutation = useMutation({
    mutationFn: (body: { csv: string }) => apiPost<{ imported: number; errors: Array<{ row: number; message: string }>; totalRows: number }>('/api/jobs/import-csv', body),
    onSuccess: (resp) => {
      setResult(resp)
      qc.invalidateQueries({ queryKey: ['officer-jobs'] })
      if (resp.imported > 0) toast.success(`Imported ${resp.imported} job${resp.imported === 1 ? '' : 's'}`)
      if (resp.errors.length > 0) toast.warning(`${resp.errors.length} row${resp.errors.length === 1 ? '' : 's'} failed`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'CSV import failed')
    },
  })

  const sample = `title,company,description,location,workArrangement,employmentType,minExperience,maxExperience,salaryMin,salaryMax,sourceUrl,externalId,batchEligible,requiredSkills,preferredSkills
Backend Engineer,TechCorp,Build APIs with Node.js,Bengaluru,hybrid,full-time,1,3,800000,1500000,https://techcorp.com/job/123,X-123,2025,Node.js|SQL|AWS,Docker
Frontend Dev,WebCo,Build React apps,Remote,remote,full-time,0,2,600000,1200000,,,,React|TypeScript,`

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import jobs from CSV</DialogTitle>
          <DialogDescription>
            Paste CSV content with a header row. Skills should be pipe-separated (e.g. <code>Node.js|SQL|AWS</code>).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="CSV content" className="text-sm">
            <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={sample} className="font-mono text-xs" />
          </Field>
          {result && (
            <div className="rounded-md border p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">Result</span>
                <span className="text-xs text-slate-500">
                  Imported {result.imported}/{result.totalRows}
                  {result.errors.length > 0 && ` · ${result.errors.length} error${result.errors.length === 1 ? '' : 's'}`}
                </span>
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs text-rose-600 dark:text-rose-400 space-y-0.5">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  {result.errors.length > 10 && <li>… and {result.errors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Close</Button>
          <Button onClick={() => mutation.mutate({ csv })} disabled={mutation.isPending || !csv.trim()}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Upload className="size-4 mr-1" />}
            Import CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  )
}
