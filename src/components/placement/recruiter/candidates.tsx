'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Users, Search, X, ArrowRight, Inbox,
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

interface StudentProfile {
  id: string
  name: string
  email: string
  batch?: string | null
  branch?: string | null
  cgpa?: number | null
  university?: string | null
  location?: string | null
}

interface UniqueCandidate {
  studentId: string
  studentName: string
  studentEmail: string
  applications: ApplicationRow[]
  latest: ApplicationRow
}

// Pick the latest status by most-recent appliedAt — applications are pre-sorted desc by the API
function pickLatest(apps: ApplicationRow[]): ApplicationRow {
  return apps[0]
}

export function Candidates() {
  const navigate = useAppStore(s => s.navigate)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [jobFilter, setJobFilter] = useState<string>('ALL')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load recruiter's own jobs (for filter dropdown)
  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ['recruiter-jobs', 'all'],
    queryFn: () => apiGet<JobsResponse>('/api/jobs?status=ALL&take=100'),
    staleTime: 60_000,
  })

  // Fetch applications — the API auto-filters by the recruiter's company
  const appsUrl = useMemo(() => {
    const p = new URLSearchParams()
    if (jobFilter !== 'ALL') p.set('jobId', jobFilter)
    return `/api/applications?${p.toString()}`
  }, [jobFilter])

  const appsQuery = useQuery<ApplicationsResponse>({
    queryKey: ['recruiter-applications', appsUrl],
    queryFn: () => apiGet<ApplicationsResponse>(appsUrl),
    staleTime: 30_000,
  })

  // Dedupe applications by studentId
  const uniqueCandidates = useMemo<UniqueCandidate[]>(() => {
    const map = new Map<string, ApplicationRow[]>()
    for (const a of appsQuery.data?.data ?? []) {
      const arr = map.get(a.studentId) ?? []
      arr.push(a)
      map.set(a.studentId, arr)
    }
    return Array.from(map.entries()).map(([studentId, applications]) => ({
      studentId,
      studentName: applications[0].studentName,
      studentEmail: applications[0].studentEmail,
      applications,
      latest: pickLatest(applications),
    }))
  }, [appsQuery.data])

  // Enrich each unique student with profile (batch/branch/cgpa).
  // useQueries caches every individual student fetch, so navigation back is instant.
  const studentQueries = useQueries({
    queries: uniqueCandidates.map((c) => ({
      queryKey: ['student', c.studentId],
      queryFn: () => apiGet<StudentProfile>(`/api/students/${c.studentId}`),
      staleTime: 120_000,
    })),
  })

  const studentById = useMemo(() => {
    const m = new Map<string, StudentProfile>()
    studentQueries.forEach((q, idx) => {
      const id = uniqueCandidates[idx]?.studentId
      if (id && q.data) m.set(id, q.data)
    })
    return m
  }, [studentQueries, uniqueCandidates])

  // Apply search filter (name or email)
  const filtered = uniqueCandidates.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.studentName.toLowerCase().includes(q) ||
      c.studentEmail.toLowerCase().includes(q)
    )
  })

  const anyFilter = Boolean(search || jobFilter !== 'ALL')
  function clearFilters() {
    setSearchInput('')
    setJobFilter('ALL')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidate profiles"
        description="Every student who has applied to one of your company's jobs"
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="cand-search" className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="cand-search"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Name or email"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filter by job</Label>
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

      {appsQuery.isLoading ? (
        <Card>
          <CardContent className="p-0">
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          </CardContent>
        </Card>
      ) : appsQuery.isError ? (
        <ErrorState
          message={(appsQuery.error as Error)?.message ?? 'Failed to load candidates'}
          onRetry={() => appsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Inbox}
              title={anyFilter ? 'No candidates match your filters' : "No candidates have applied to your company's jobs yet"}
              description={anyFilter ? 'Try adjusting or clearing filters' : 'Once students apply, they will appear here'}
              action={anyFilter ? <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} candidate{filtered.length === 1 ? '' : 's'}
          </p>
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[70vh] scroll-area-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Candidate</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Batch</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Branch</TableHead>
                      <TableHead className="text-xs text-right hidden sm:table-cell">CGPA</TableHead>
                      <TableHead className="text-xs text-right">Applications</TableHead>
                      <TableHead className="text-xs">Latest status</TableHead>
                      <TableHead className="text-xs text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(c => {
                      const profile = studentById.get(c.studentId)
                      return (
                        <TableRow
                          key={c.studentId}
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => navigate('recruiter/candidates', { id: c.studentId, jobId: c.latest.jobId })}
                        >
                          <TableCell>
                            <div className="font-medium text-sm">{c.studentName}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[220px]">{c.studentEmail}</div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">
                            {profile ? (profile.batch ?? '—') : <Skeleton className="h-3 w-12" />}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">
                            {profile ? (profile.branch ?? '—') : <Skeleton className="h-3 w-24" />}
                          </TableCell>
                          <TableCell className="text-right text-xs tabular-nums hidden sm:table-cell">
                            {profile ? (profile.cgpa != null ? profile.cgpa.toFixed(2) : '—') : <Skeleton className="h-3 w-8 ml-auto" />}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className="tabular-nums text-xs">{c.applications.length}</Badge>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={c.latest.status} size="sm" />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate('recruiter/candidates', { id: c.studentId, jobId: c.latest.jobId })
                              }}
                            >
                              View <ArrowRight className="size-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

export function CandidatesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Candidate profiles" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton className="md:col-span-2" />
        <CardSkeleton />
      </div>
      <Card>
        <CardContent className="p-4 flex items-center gap-3 text-muted-foreground">
          <Users className="size-4 animate-pulse" /> Loading candidates…
        </CardContent>
      </Card>
    </div>
  )
}
