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

export function Pipeline() {
  const navigate = useAppStore(s => s.navigate)
  const routeJobId = useAppStore(s => s.route.params?.jobId)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [jobFilter, setJobFilter] = useState<string>(routeJobId ?? 'ALL')

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
  const byStatus = new Map<ApplicationStatus, ApplicationRow[]>()
  for (const a of apps) {
    const arr = byStatus.get(a.status) ?? []
    arr.push(a)
    byStatus.set(a.status, arr)
  }

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
              <Label htmlFor="rp-search" className="text-xs uppercase tracking-wider text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
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
              <Label className="text-xs uppercase tracking-wider text-slate-500">Status</Label>
              <Select value={statusFilter} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-slate-500">Job</Label>
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
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-600 dark:text-slate-400">
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
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs">Job</TableHead>
                      <TableHead className="text-xs">Company</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Applied</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps.map(a => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`recruiter/applications/${a.id}`)}
                      >
                        <TableCell>
                          <div className="text-sm font-medium">{a.studentName}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[180px]">{a.studentEmail}</div>
                        </TableCell>
                        <TableCell className="text-sm">{a.jobTitle}</TableCell>
                        <TableCell className="text-xs text-slate-500">{a.companyName}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="text-xs">{formatDate(a.appliedAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={(e) => { e.stopPropagation(); navigate(`recruiter/applications/${a.id}`) }}
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
          </TabsContent>

          {/* Board view */}
          <TabsContent value="board">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {PIPELINE_COLUMNS.map(col => {
                const items = byStatus.get(col.status) ?? []
                return (
                  <Card key={col.status} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {col.label}
                        </span>
                        <Badge variant="secondary" className="text-xs tabular-nums">{items.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-2">
                      {items.length === 0 ? (
                        <div className="text-xs text-slate-400 text-center py-6">No items</div>
                      ) : (
                        <ScrollArea className="max-h-96">
                          <ul className="space-y-2">
                            {items.map(a => (
                              <li
                                key={a.id}
                                className="rounded-md border p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer bg-white dark:bg-slate-950"
                                onClick={() => navigate(`recruiter/applications/${a.id}`)}
                              >
                                <div className="text-sm font-medium truncate">{a.studentName}</div>
                                <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                  <Briefcase className="size-3" /> {a.jobTitle}
                                </div>
                                <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-1">
                                  <MapPin className="size-3" /> {a.companyName}
                                </div>
                                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-3" />
                                    {formatDate(a.appliedAt)}
                                  </span>
                                  {a.resume && <Badge variant="outline" className="text-xs">Resume</Badge>}
                                </div>
                                <Button size="sm" variant="ghost" className="w-full mt-2 h-7 text-xs">
                                  View <ArrowRight className="size-3 ml-1" />
                                </Button>
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
