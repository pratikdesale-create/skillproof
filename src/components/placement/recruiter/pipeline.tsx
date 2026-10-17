'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search, X, Inbox, Clock, ArrowRight, LayoutGrid, List, MapPin, Briefcase,
} from 'lucide-react'
import type { ApplicationStatus } from '@/types'

interface ApplicationRow {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  jobId: string
  jobTitle: string
  companyId: string
  companyName: string
  status: ApplicationStatus
  appliedAt: string
  coverLetter?: string | null
  resume?: { id: string; title: string } | null
}
interface ApplicationsResponse { data: ApplicationRow[]; total: number }

interface JobListItem { id: string; title: string; status: string }
interface JobsResponse { data: JobListItem[]; total: number }

const PIPELINE_COLUMNS: { status: ApplicationStatus; label: string }[] = [
  { status: 'APPLIED', label: 'Applied' },
  { status: 'UNDER_REVIEW', label: 'Under Review' },
  { status: 'SHORTLISTED', label: 'Shortlisted' },
  { status: 'ASSESSMENT', label: 'Assessment' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'WITHDRAWN', label: 'Withdrawn' },
]

const ALL_STATUSES = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']

export function Pipeline({ filterJobId }: { filterJobId?: string }) {
  const navigate = useAppStore(s => s.navigate)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  // Initial job filter from route params (e.g., when navigating from job detail "View applications").
  // The user can override this via the dropdown.
  const [jobFilter, setJobFilter] = useState<string>(filterJobId ?? 'ALL')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load company jobs (for filter dropdown)
  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ['recruiter-jobs', 'all'],
    queryFn: () => apiGet<JobsResponse>('/api/jobs?status=ALL&take=100'),
    staleTime: 60_000,
  })

  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (jobFilter !== 'ALL') params.set('jobId', jobFilter)
    return `/api/applications?${params.toString()}`
  }, [statusFilter, jobFilter])

  const { data, isLoading, isError, error, refetch } = useQuery<ApplicationsResponse>({
    queryKey: ['recruiter-applications', url],
    queryFn: () => apiGet<ApplicationsResponse>(url),
    staleTime: 30_000,
  })

  const apps = (data?.data ?? []).filter(a =>
    !search ||
    a.studentName.toLowerCase().includes(search.toLowerCase()) ||
    a.studentEmail.toLowerCase().includes(search.toLowerCase()) ||
    a.jobTitle.toLowerCase().includes(search.toLowerCase())
  )
  const total = apps.length

  // Group by status for board view
  const byStatus = useMemo(() => {
    const m = new Map<ApplicationStatus, ApplicationRow[]>()
    for (const a of apps) {
      const arr = m.get(a.status) ?? []
      arr.push(a)
      m.set(a.status, arr)
    }
    return m
  }, [apps])

  const anyFilter = Boolean(search || statusFilter !== 'ALL' || jobFilter !== 'ALL')
  function clearFilters() {
    setSearchInput('')
    setStatusFilter('ALL')
    setJobFilter('ALL')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment pipeline"
        description={`${data?.total ?? 0} application${data?.total === 1 ? '' : 's'} for your company`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="rp-search" className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="rp-search"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Student, email, job title"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Job</Label>
              <Select
                value={jobFilter}
                onValueChange={v => setJobFilter(v)}
                disabled={jobsQuery.isLoading || (jobsQuery.data?.data.length ?? 0) === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={jobsQuery.isLoading ? 'Loading…' : 'All jobs'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All jobs</SelectItem>
                  {jobsQuery.data?.data.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>
                  ))}
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

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState
          message={(error as Error)?.message ?? 'Failed to load applications'}
          onRetry={() => refetch()}
        />
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Inbox}
              title={anyFilter ? 'No applications match your filters' : 'No applications yet'}
              description={anyFilter ? 'Try adjusting or clearing filters' : 'Once students apply to your jobs, you will see them here'}
              action={anyFilter ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="table">
          <TabsList>
            <TabsTrigger value="table"><List className="size-3.5 mr-1" /> Table</TabsTrigger>
            <TabsTrigger value="board"><LayoutGrid className="size-3.5 mr-1" /> Board</TabsTrigger>
          </TabsList>

          {/* Table view */}
          <TabsContent value="table">
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[70vh] scroll-area-thin">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Student</TableHead>
                        <TableHead className="text-xs">Job</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">Company</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Applied</TableHead>
                        <TableHead className="text-xs text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apps.map(a => (
                        <TableRow
                          key={a.id}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate('recruiter/applications', { id: a.id })}
                        >
                          <TableCell>
                            <div className="text-sm font-medium">{a.studentName}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">{a.studentEmail}</div>
                          </TableCell>
                          <TableCell className="text-sm">{a.jobTitle}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{a.companyName}</TableCell>
                          <TableCell><StatusBadge status={a.status} size="sm" /></TableCell>
                          <TableCell className="text-xs">{formatDate(a.appliedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={(e) => { e.stopPropagation(); navigate('recruiter/applications', { id: a.id }) }}
                            >
                              View <ArrowRight className="size-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Board view */}
          <TabsContent value="board">
            {/* Horizontal scroll on narrow screens so the kanban stays usable on mobile */}
            <div className="w-full overflow-x-auto scroll-area-thin pb-2">
              <div className="flex gap-4 min-w-max">
                {PIPELINE_COLUMNS.map(col => {
                  const items = byStatus.get(col.status) ?? []
                  return (
                    <Card key={col.status} className="flex flex-col w-[260px] sm:w-[280px] shrink-0">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center justify-between">
                          <span className="uppercase tracking-wider text-muted-foreground">
                            {col.label}
                          </span>
                          <Badge variant="secondary" className="text-xs tabular-nums">
                            {items.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 p-2">
                        {items.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-6">No items</div>
                        ) : (
                          <ScrollArea className="max-h-96 scroll-area-thin">
                            <ul className="space-y-2">
                              {items.map(a => (
                                <li
                                  key={a.id}
                                  className="rounded-md border p-3 hover:bg-muted/40 cursor-pointer bg-card"
                                  onClick={() => navigate('recruiter/applications', { id: a.id })}
                                >
                                  <div className="text-sm font-medium truncate">{a.studentName}</div>
                                  <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                    <Briefcase className="size-3" /> {a.jobTitle}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                                    <MapPin className="size-3" /> {a.companyName}
                                  </div>
                                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Clock className="size-3" />
                                      {formatDate(a.appliedAt)}
                                    </span>
                                    {a.resume && <Badge variant="outline" className="text-xs">Resume</Badge>}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </ScrollArea>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}

export function PipelineSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Recruitment pipeline" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
