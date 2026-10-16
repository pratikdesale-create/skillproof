'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet, api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatSalary, formatDate,
} from '@/components/placement/shared/ui'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase, Search, Plus, MapPin, ArrowRight, Loader2, X, Building2,
} from 'lucide-react'
import { JobForm } from './job-form'
import type { AuthUser, RecruiterProfile } from '@/types'

interface JobListItem {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string; industry?: string | null }
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  sourceType: string
  postingDate: string
  closingDate?: string | null
  status: string
  batchEligible?: string | null
  requiredSkillCount: number
  preferredSkillCount: number
}
interface JobsResponse {
  data: JobListItem[]
  total: number
  skip: number
  take: number
}

interface MeResponse {
  user: AuthUser | null
  profile: RecruiterProfile & { id: string; companyId?: string | null } | null
}

export function Jobs() {
  const navigate = useAppStore(s => s.navigate)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('OPEN')
  const [createOpen, setCreateOpen] = useState(false)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
    params.set('skip', '0')
    params.set('take', '100')
    return `/api/jobs?${params.toString()}`
  }, [search, statusFilter])

  const { data, isLoading, isError, error, refetch } = useQuery<JobsResponse>({
    queryKey: ['recruiter-jobs', url],
    queryFn: () => apiGet<JobsResponse>(url),
    staleTime: 30_000,
  })

  // Fetch /api/me for company info (used by create form)
  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/me'),
    staleTime: 60_000,
  })

  const companyId = meQuery.data?.profile?.companyId ?? null
  const companyName = (meQuery.data?.profile as { company?: { name?: string } } | null)?.company?.name ?? null

  const jobs = data?.data ?? []
  const total = data?.total ?? 0

  function clearFilters() {
    setSearchInput('')
    setStatusFilter('OPEN')
  }
  const anyFilter = Boolean(search || statusFilter !== 'OPEN')

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company jobs"
        description={companyName ? `Managing roles for ${companyName}` : 'Your open and closed job postings'}
      >
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!companyId}>
          <Plus className="size-4 mr-1" /> Create job
        </Button>
      </PageHeader>

      {!companyId && !meQuery.isLoading && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
            No company is bound to your recruiter profile. Ask an officer to assign your company before creating jobs.
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="rjob-search" className="text-xs uppercase tracking-wider text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  id="rjob-search"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Title, keyword"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-slate-500">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {anyFilter && (
            <div className="mt-3 flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-600 dark:text-slate-400">
                <X className="size-3.5 mr-1" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message ?? 'Failed to load jobs'}
          onRetry={() => refetch()}
        />
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Briefcase}
              title={anyFilter ? 'No jobs match your filters' : 'No jobs yet'}
              description={anyFilter ? 'Try adjusting or clearing filters' : 'Create your first job posting'}
              action={
                <div className="flex gap-2">
                  {anyFilter && <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>}
                  {companyId && !anyFilter && (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="size-4 mr-1" /> Create job
                    </Button>
                  )}
                </div>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {total} job{total === 1 ? '' : 's'} for your company
          </p>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Arrangement</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Posted</TableHead>
                    <TableHead className="text-xs text-right">Skills (R/P)</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map(job => (
                    <TableRow
                      key={job.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`recruiter/jobs/${job.id}`)}
                    >
                      <TableCell className="font-medium text-sm">
                        {job.title}
                        {job.batchEligible && (
                          <Badge variant="outline" className="ml-2 text-[10px] bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900">
                            Batch {job.batchEligible}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {job.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" /> {job.location}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{job.workArrangement ?? '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{job.employmentType ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="secondary" className="text-[10px]">{job.sourceType}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(job.postingDate)}</TableCell>
                      <TableCell className="text-xs text-right tabular-nums">
                        {job.requiredSkillCount} / {job.preferredSkillCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            job.status === 'OPEN'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 text-xs'
                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 text-xs'
                          }
                        >
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`recruiter/jobs/${job.id}`)
                          }}
                          className="h-7"
                        >
                          View <ArrowRight className="size-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create job dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create new job posting</DialogTitle>
            <DialogDescription>
              {companyName ? `For ${companyName}` : 'Fill the form below'}
              . Skill names will be normalized to canonical skills.
            </DialogDescription>
          </DialogHeader>
          <JobForm
            mode="create"
            companyId={companyId ?? undefined}
            onSaved={() => setCreateOpen(false)}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function JobsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Company jobs" description="Loading…" />
      <Card><CardContent className="p-4"><Loader2 className="size-4 animate-spin" /></CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
