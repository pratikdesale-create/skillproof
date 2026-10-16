'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, formatDate,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Search, ArrowRight, Clock, Loader2, Briefcase,
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

const PIPELINE: { status: ApplicationStatus; label: string }[] = [
  { status: 'APPLIED', label: 'Applied' },
  { status: 'UNDER_REVIEW', label: 'Under Review' },
  { status: 'SHORTLISTED', label: 'Shortlisted' },
  { status: 'ASSESSMENT', label: 'Assessment' },
  { status: 'INTERVIEW', label: 'Interview' },
  { status: 'OFFER', label: 'Offer' },
  { status: 'REJECTED', label: 'Rejected' },
  { status: 'WITHDRAWN', label: 'Withdrawn' },
]

const STATUSES = ['ALL', ...PIPELINE.map((p) => p.status)] as const

export function Pipeline({ filterStudentId }: { filterStudentId?: string }) {
  const navigate = useAppStore(s => s.navigate)

  const [statusFilter, setStatusFilter] = useState<'ALL' | ApplicationStatus>('ALL')
  const [company, setCompany] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const url = useMemo(() => {
    const p = new URLSearchParams()
    if (statusFilter !== 'ALL') p.set('status', statusFilter)
    if (company) p.set('company', company)
    return `/api/applications?${p.toString()}`
  }, [statusFilter, company])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ApplicationsResponse>({
    queryKey: ['officer-applications', url],
    queryFn: () => apiGet<ApplicationsResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const all = data?.data ?? []
  // Local search & student filter on top of API response (since the API doesn't support search by text)
  const filtered = useMemo(() => {
    let out = all
    if (filterStudentId) {
      out = out.filter((a) => a.studentId === filterStudentId)
    }
    if (search) {
      const s = search.toLowerCase()
      out = out.filter((a) =>
        a.studentName.toLowerCase().includes(s) ||
        a.studentEmail.toLowerCase().includes(s) ||
        a.jobTitle.toLowerCase().includes(s) ||
        a.companyName.toLowerCase().includes(s)
      )
    }
    return out
  }, [all, search, filterStudentId])

  // Company options from data
  const companyOptions = useMemo(() => {
    const set = new Map<string, string>()
    for (const a of all) set.set(a.companyId, a.companyName)
    return Array.from(set.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [all])

  // Group for board
  const byStatus = useMemo(() => {
    const map = new Map<ApplicationStatus, ApplicationRow[]>()
    for (const a of filtered) {
      const arr = map.get(a.status) ?? []
      arr.push(a)
      map.set(a.status, arr)
    }
    return map
  }, [filtered])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application Pipeline"
        description={`${filtered.length} application${filtered.length === 1 ? '' : 's'}`}
      >
        {filterStudentId && (
          <Button variant="outline" size="sm" onClick={() => navigate(`officer/students/${filterStudentId}`)}>
            <ArrowRight className="size-4 mr-1 rotate-180" /> View student
          </Button>
        )}
      </PageHeader>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs text-slate-500">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                <Input
                  placeholder="Student, job, company…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-500">Status</Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s === 'ALL' ? 'All statuses' : s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>
          {isFetching && filtered.length > 0 && (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Refreshing…
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>
        <TabsContent value="table">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : isError ? (
                <ErrorState message={(error as Error)?.message ?? 'Failed to load applications'} onRetry={() => refetch()} />
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="No applications"
                  description={statusFilter !== 'ALL' || company || search ? 'Try adjusting filters' : 'Applications will appear here once students apply'}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead className="hidden md:table-cell">Company</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">Applied</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((a) => (
                      <TableRow
                        key={a.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`officer/applications/${a.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium text-sm">{a.studentName}</div>
                          <div className="text-xs text-slate-500 md:hidden">{a.companyName}</div>
                        </TableCell>
                        <TableCell className="text-sm">{a.jobTitle}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{a.companyName}</TableCell>
                        <TableCell><StatusBadge status={a.status} /></TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Clock className="size-3" />
                            {formatDate(a.appliedAt)}
                          </span>
                        </TableCell>
                        <TableCell><ArrowRight className="size-4 text-slate-400" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="board">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i}><CardContent className="p-4 space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></CardContent></Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card><CardContent className="p-0"><EmptyState icon={Briefcase} title="No applications" description="Try adjusting filters" /></CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {PIPELINE.map((col) => {
                const items = byStatus.get(col.status) ?? []
                return (
                  <Card key={col.status} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center justify-between">
                        <span className="uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {col.label}
                        </span>
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          {items.length}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 p-2">
                      {items.length === 0 ? (
                        <div className="text-xs text-slate-400 text-center py-6">No items</div>
                      ) : (
                        <ScrollArea className="max-h-96">
                          <ul className="space-y-2">
                            {items.map((a) => (
                              <li
                                key={a.id}
                                className="rounded-md border p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                                onClick={() => navigate(`officer/applications/${a.id}`)}
                              >
                                <div className="text-sm font-medium truncate">{a.studentName}</div>
                                <div className="text-xs text-slate-500 truncate mt-0.5">{a.jobTitle}</div>
                                <div className="text-xs text-slate-500 truncate">{a.companyName}</div>
                                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
