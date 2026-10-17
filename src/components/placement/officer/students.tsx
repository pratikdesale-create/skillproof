'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, CardSkeleton,
} from '@/components/placement/shared/ui'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Users, Search, ShieldCheck, ArrowRight, X, Loader2, Download,
  GraduationCap, ClipboardList, Target,
} from 'lucide-react'
import { toast } from 'sonner'

interface TopSkill { name: string; category?: string | null; isVerified: boolean }
interface StudentRow {
  id: string
  name: string
  email: string
  avatarUrl?: string | null
  university?: string | null
  batch?: string | null
  branch?: string | null
  cgpa?: number | null
  location?: string | null
  graduationYear?: number | null
  skillsCount: number
  verifiedSkillsCount: number | null
  evidenceCount: number
  evidenceByStatus?: Record<string, number>
  applicationsCount?: number
  matchesCount?: number
  profileCompletion: number
  topSkills?: TopSkill[]
}
interface StudentsResponse {
  data: StudentRow[]
  total: number
  skip: number
  take: number
}

const PAGE_SIZE = 20
const BATCH_OPTIONS = ['2024', '2025', '2026']
const BRANCH_OPTIONS = [
  'Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical',
  'Information Technology', 'Chemical',
]

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function Students() {
  const navigate = useAppStore(s => s.navigate)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [batch, setBatch] = useState('')
  const [branch, setBranch] = useState('')
  const [minCgpa, setMinCgpa] = useState(0)
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [skip, setSkip] = useState(0)

  // Debounce search — only the search input is debounced; this effect's setState calls
  // are gated by a timeout, so they do not run synchronously inside the effect body.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setSkip(0)
    }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  // Setters that reset pagination when a filter changes — avoids useEffect-based reset.
  const updateBatch = useCallback((v: string) => { setBatch(v); setSkip(0) }, [])
  const updateBranch = useCallback((v: string) => { setBranch(v); setSkip(0) }, [])
  const updateMinCgpa = useCallback((v: number) => { setMinCgpa(v); setSkip(0) }, [])
  const updateVerifiedOnly = useCallback((v: boolean) => { setVerifiedOnly(v); setSkip(0) }, [])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (batch) p.set('batch', batch)
    if (branch) p.set('branch', branch)
    if (minCgpa > 0) p.set('minCgpa', String(minCgpa))
    if (verifiedOnly) p.set('verifiedOnly', 'true')
    p.set('skip', String(skip))
    p.set('take', String(PAGE_SIZE))
    return `/api/students?${p.toString()}`
  }, [search, batch, branch, minCgpa, verifiedOnly, skip])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<StudentsResponse>({
    queryKey: ['officer-students', url],
    queryFn: () => apiGet<StudentsResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const hasMore = skip + rows.length < total

  function clearFilters() {
    setSearchInput('')
    setBatch('')
    setBranch('')
    setMinCgpa(0)
    setVerifiedOnly(false)
    setSkip(0)
  }

  const anyFilter = Boolean(search || batch || branch || minCgpa > 0 || verifiedOnly)

  function exportCsv() {
    if (rows.length === 0) {
      toast.error('No students to export')
      return
    }
    const headers = [
      'Name', 'Email', 'Batch', 'Branch', 'Graduation Year', 'CGPA',
      'Skills Count', 'Verified Skills', 'Evidence Count', 'Applications', 'Matches', 'Profile Completion',
    ]
    const lines = [headers.join(',')]
    for (const s of rows) {
      const cols = [
        s.name, s.email, s.batch ?? '', s.branch ?? '',
        s.graduationYear != null ? String(s.graduationYear) : '',
        s.cgpa != null ? s.cgpa.toFixed(2) : '',
        String(s.skillsCount),
        s.verifiedSkillsCount != null ? String(s.verifiedSkillsCount) : '',
        String(s.evidenceCount),
        String(s.applicationsCount ?? 0),
        String(s.matchesCount ?? 0),
        `${s.profileCompletion}%`,
      ]
      lines.push(cols.map(escapeCsv).join(','))
    }
    const csv = lines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const dlUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = dlUrl
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(dlUrl)
    toast.success(`Exported ${rows.length} student${rows.length === 1 ? '' : 's'}`)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={`${total} student${total === 1 ? '' : 's'} in the directory`}
      >
        <Button
          size="sm"
          variant="outline"
          onClick={exportCsv}
          disabled={rows.length === 0}
        >
          <Download className="size-4 mr-1" /> Export CSV
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
              <Label htmlFor="search" className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Name, email, location…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Batch</Label>
              <Select value={batch || 'ALL'} onValueChange={(v) => updateBatch(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All batches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All batches</SelectItem>
                  {BATCH_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branch</Label>
              <Select value={branch || 'ALL'} onValueChange={(v) => updateBranch(v === 'ALL' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All branches</SelectItem>
                  {BRANCH_OPTIONS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Min CGPA: <span className="font-medium tabular-nums">{minCgpa.toFixed(1)}</span>
              </Label>
              <Slider
                min={0}
                max={10}
                step={0.1}
                value={[minCgpa]}
                onValueChange={(vals) => updateMinCgpa(vals[0] ?? 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 pt-2 border-t">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={verifiedOnly}
                onCheckedChange={updateVerifiedOnly}
              />
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-4 text-[var(--verified-foreground)]" />
                Verified skills only
              </span>
            </label>
            {anyFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-4 mr-1" /> Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState
              message={(error as Error)?.message ?? 'Failed to load students'}
              onRetry={() => refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No students found"
              description={anyFilter ? 'Try adjusting your filters' : 'Students will appear here once they register'}
              action={anyFilter ? <Button size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Course / branch</TableHead>
                    <TableHead className="hidden lg:table-cell">Grad year</TableHead>
                    <TableHead className="hidden md:table-cell">Relevant skills</TableHead>
                    <TableHead className="hidden lg:table-cell">Evidence</TableHead>
                    <TableHead className="hidden xl:table-cell">Matches</TableHead>
                    <TableHead className="hidden lg:table-cell">Applications</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => {
                    const ev = s.evidenceByStatus ?? {}
                    const verified = ev.VERIFIED ?? 0
                    const pending = (ev.PENDING_REVIEW ?? 0) + (ev.NEEDS_MORE_EVIDENCE ?? 0) + (ev.UNVERIFIED ?? 0)
                    return (
                      <TableRow
                        key={s.id}
                        className="cursor-pointer"
                        onClick={() => navigate('officer/students', { id: s.id })}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{s.email}</div>
                          <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                            {s.branch ?? '—'} · {s.batch ?? '—'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <div className="flex items-center gap-1">
                            <GraduationCap className="size-3 text-muted-foreground" />
                            <span>{s.branch ?? '—'}</span>
                          </div>
                          {s.university && (
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={s.university}>
                              {s.university}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">Batch {s.batch ?? '—'}</div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm tabular-nums">
                          {s.graduationYear ?? '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {s.topSkills && s.topSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {s.topSkills.map((sk, i) => (
                                <SkillTag key={i} name={sk.name} isVerified={sk.isVerified} size="sm" />
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No skills</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {s.evidenceCount === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1">
                                <ShieldCheck className="size-3 text-[var(--verified-foreground)]" />
                                <span className="text-xs tabular-nums">{verified} verified</span>
                              </div>
                              {pending > 0 && (
                                <div className="flex items-center gap-1">
                                  <ClipboardList className="size-3 text-[var(--pending-foreground)]" />
                                  <span className="text-xs tabular-nums">{pending} pending</span>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell">
                          {s.matchesCount != null && s.matchesCount > 0 ? (
                            <Badge variant="outline" className="text-xs gap-1">
                              <Target className="size-3" /> {s.matchesCount}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {s.applicationsCount != null && s.applicationsCount > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              {s.applicationsCount}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ArrowRight className="size-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between p-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Showing {skip + 1}–{skip + rows.length} of {total}
                </p>
                {hasMore ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSkip((s) => s + PAGE_SIZE)}
                    disabled={isFetching}
                  >
                    {isFetching ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
                    Load more
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function StudentsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Students" description="Loading…" />
      <CardSkeleton />
      <Card><CardContent className="p-4 space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</CardContent></Card>
    </div>
  )
}
