'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet, api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Briefcase, Search, Plus, MapPin, ArrowRight, Loader2, X, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  applicationsCount?: number
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

// Semantic-toned status badges. OPEN=verified, CLOSED=muted, ARCHIVED=danger, DRAFT=pending.
const JOB_STATUS_CLS: Record<string, string> = {
  OPEN: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  CLOSED: 'bg-muted text-muted-foreground border-border',
  ARCHIVED: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  DRAFT: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
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
        title="My jobs"
        description={companyName ? `Managing roles for ${companyName}` : 'Your open and closed job postings'}
      >
        <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!companyId}>
          <Plus className="size-4 mr-1" /> Create job
        </Button>
      </PageHeader>

      {!companyId && !meQuery.isLoading && (
        <Card className="border-[var(--pending)]/30 bg-[var(--pending-muted)]/40">
          <CardContent className="p-4 text-sm text-[var(--pending-foreground)]">
            No company is bound to your recruiter profile. Ask an officer to assign your company before creating jobs.
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="rjob-search" className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="size-3.5 mr-1" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-2">
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
              title={anyFilter ? 'No jobs match your filters' : 'No jobs posted yet'}
              description={anyFilter ? 'Try adjusting or clearing filters' : 'Create your first job posting to start receiving candidates.'}
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
          <p className="text-sm text-muted-foreground">
            {total} job{total === 1 ? '' : 's'} for your company
          </p>
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[70vh] scroll-area-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Title</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Location</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Arrangement</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Type</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Source</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">Posted</TableHead>
                      <TableHead className="text-xs text-right hidden md:table-cell">Applications</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map(job => (
                      <TableRow
                        key={job.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => navigate('recruiter/jobs', { id: job.id })}
                      >
                        <TableCell className="font-medium text-sm">
                          {job.title}
                          {job.batchEligible && (
                            <Badge variant="outline" className="ml-2 text-[10px] bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30">
                              Batch {job.batchEligible}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {job.location ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" /> {job.location}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs capitalize">{job.workArrangement ?? '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs capitalize">{job.employmentType ?? '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <Badge variant="secondary" className="text-[10px]">{job.sourceType}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs">{formatDate(job.postingDate)}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-right tabular-nums">
                          {job.applicationsCount ?? '—'}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', JOB_STATUS_CLS[job.status] ?? '')}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate('recruiter/jobs', { id: job.id })
                              }}
                              aria-label="Edit"
                            >
                              Edit <ArrowRight className="size-3 ml-1" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate('recruiter/shortlist', { jobId: job.id })
                              }}
                              aria-label="View candidates"
                            >
                              <Users className="size-3 mr-1" /> Candidates
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
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
      <PageHeader title="My jobs" description="Loading…" />
      <Card><CardContent className="p-4"><Loader2 className="size-4 animate-spin" /></CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
