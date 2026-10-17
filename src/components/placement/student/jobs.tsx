'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  formatSalary, formatDate,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Briefcase, MapPin, Search, Building2, Calendar, ArrowRight, Loader2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface JobCompany { id: string; name: string; industry?: string | null }
interface JobListItem {
  id: string
  title: string
  companyId: string
  company: JobCompany
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  minExperience?: number | null
  maxExperience?: number | null
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
interface JobsResponse {
  data: JobListItem[]
  total: number
  skip: number
  take: number
}

const PAGE_SIZE = 20

type SortKey = 'postingDate' | 'closingDate' | 'titleAsc'

export function Jobs() {
  const navigate = useAppStore(s => s.navigate)

  // Filter state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('')
  const [location, setLocation] = useState('')
  const [workArrangement, setWorkArrangement] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [sort, setSort] = useState<SortKey>('postingDate')
  const [skip, setSkip] = useState(0)

  // Debounce search input → search query (300ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setSkip(0)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Build URL — note: the /api/jobs endpoint supports search, batch, location,
  // workArrangement, status, skip, take. employmentType filter is applied
  // client-side (filter the returned page) because the API does not expose it.
  const url = useMemo(() => {
    const params = new URLSearchParams({ status: 'OPEN' })
    if (search) params.set('search', search)
    if (batch) params.set('batch', batch)
    if (location) params.set('location', location)
    if (workArrangement) params.set('workArrangement', workArrangement)
    params.set('skip', String(skip))
    params.set('take', String(PAGE_SIZE))
    return `/api/jobs?${params.toString()}`
  }, [search, batch, location, workArrangement, skip])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<JobsResponse>({
    queryKey: ['student-jobs', url],
    queryFn: () => apiGet<JobsResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  // Apply client-side employmentType filter + sort to the returned page
  const jobs = useMemo(() => {
    const list = (data?.data ?? []).filter(j => !employmentType || j.employmentType === employmentType)
    const sorted = [...list]
    if (sort === 'closingDate') {
      sorted.sort((a, b) => {
        const ta = a.closingDate ? new Date(a.closingDate).getTime() : Infinity
        const tb = b.closingDate ? new Date(b.closingDate).getTime() : Infinity
        return ta - tb
      })
    } else if (sort === 'titleAsc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else {
      // postingDate desc — API order, preserve as-is
      sorted.sort((a, b) => new Date(b.postingDate).getTime() - new Date(a.postingDate).getTime())
    }
    return sorted
  }, [data, employmentType, sort])

  const total = data?.total ?? 0
  const hasMore = skip + jobs.length < total

  function clearFilters() {
    setSearchInput('')
    setBatch('')
    setLocation('')
    setWorkArrangement('')
    setEmploymentType('')
    setSort('postingDate')
    setSkip(0)
  }

  const anyFilter = Boolean(search || batch || location || workArrangement || employmentType)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find Jobs"
        description={`${total} open role${total === 1 ? '' : 's'} matching your filters`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="job-search" className="text-xs uppercase tracking-wider text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="job-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Title, company, keyword"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-loc" className="text-xs uppercase tracking-wider text-muted-foreground">Location</Label>
              <Input
                id="job-loc"
                value={location}
                onChange={(e) => { setLocation(e.target.value); setSkip(0) }}
                placeholder="e.g. Bengaluru"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-batch" className="text-xs uppercase tracking-wider text-muted-foreground">Eligibility (batch)</Label>
              <Input
                id="job-batch"
                value={batch}
                onChange={(e) => { setBatch(e.target.value); setSkip(0) }}
                placeholder="e.g. 2025"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="job-wa" className="text-xs uppercase tracking-wider text-muted-foreground">Work arrangement</Label>
              <Select
                value={workArrangement || 'any'}
                onValueChange={(v) => { setWorkArrangement(v === 'any' ? '' : v); setSkip(0) }}
              >
                <SelectTrigger id="job-wa" className="w-full">
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
              <Label htmlFor="job-et" className="text-xs uppercase tracking-wider text-muted-foreground">Job type</Label>
              <Select
                value={employmentType || 'any'}
                onValueChange={(v) => { setEmploymentType(v === 'any' ? '' : v); setSkip(0) }}
              >
                <SelectTrigger id="job-et" className="w-full">
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
            <div className="space-y-1.5">
              <Label htmlFor="job-sort" className="text-xs uppercase tracking-wider text-muted-foreground">Sort by</Label>
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
              >
                <SelectTrigger id="job-sort" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="postingDate">Posting date (newest)</SelectItem>
                  <SelectItem value="closingDate">Closing soon</SelectItem>
                  <SelectItem value="titleAsc">Title (A–Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {anyFilter && (
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5 mr-1" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {isLoading && skip === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
              title="No jobs match your filters"
              description="Try adjusting search or filters. New roles are posted regularly — check back soon."
              action={anyFilter ? (
                <Button size="sm" onClick={clearFilters}>Clear filters</Button>
              ) : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onView={() => navigate(`student/jobs/${job.id}`)} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setSkip(s => s + PAGE_SIZE)} disabled={isFetching}>
                {isFetching ? <><Loader2 className="size-4 mr-2 animate-spin" /> Loading…</> : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function JobCard({ job, onView }: { job: JobListItem; onView: () => void }) {
  const salary = formatSalary(job.salaryMin, job.salaryMax, 'INR')
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{job.title}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 mt-1">
              <Building2 className="size-3.5" />
              {job.company.name}
              {job.company.industry ? ` · ${job.company.industry}` : ''}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            {job.sourceType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
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
          {job.batchEligible && (
            <Badge variant="outline">Batch {job.batchEligible}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Salary</div>
            <div className="font-medium">{salary}</div>
          </div>
          <div className="flex items-center gap-3 text-right">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Required</div>
              <div className="font-medium tabular-nums">{job.requiredSkillCount}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Preferred</div>
              <div className="font-medium tabular-nums">{job.preferredSkillCount}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span className="flex items-center gap-1">
            <Calendar className="size-3" /> Posted {formatDate(job.postingDate)}
          </span>
          {job.closingDate && (
            <span>Closes {formatDate(job.closingDate)}</span>
          )}
        </div>
        <Button size="sm" className="w-full" onClick={onView}>
          View &amp; analyze fit <ArrowRight className="size-3.5 ml-1" />
        </Button>
      </CardContent>
    </Card>
  )
}

export function JobsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Find Jobs" description="Loading roles…" />
      <Card><CardContent className="p-4"><div className="h-24 w-full bg-muted/40 animate-pulse rounded" /></CardContent></Card>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
