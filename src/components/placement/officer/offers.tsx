'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, EmptyState, ErrorState, StatCard,
  formatSalary, formatDate, formatDateTime, formatCurrency,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DollarSign, ArrowRight, CheckCircle2, Wallet,
} from 'lucide-react'

interface OfferRow {
  id: string
  applicationId: string
  amount?: number | null
  currency?: string | null
  decision: string
  expiresAt?: string | null
  createdAt: string
  application: {
    id: string
    status: string
    student: {
      id: string
      user: { id: string; name: string; email: string }
      batch?: string | null
      branch?: string | null
    }
    job: { id: string; title: string; company: { id: string; name: string } }
  }
}
interface OffersResponse {
  data: OfferRow[]
  total: number
  skip: number
  take: number
  totalAmount: number
  acceptedCount: number
}

type DecisionFilter = 'all' | 'PENDING' | 'ACCEPTED' | 'DECLINED'

export function Offers() {
  const navigate = useAppStore(s => s.navigate)
  const [decision, setDecision] = useState<DecisionFilter>('all')

  const url = useMemo(() => {
    const p = new URLSearchParams()
    p.set('decision', decision)
    p.set('skip', '0')
    p.set('take', '200')
    return `/api/offers?${p.toString()}`
  }, [decision])

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<OffersResponse>({
    queryKey: ['officer-offers', url],
    queryFn: () => apiGet<OffersResponse>(url),
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  })

  const rows = data?.data ?? []
  const total = data?.total ?? 0
  const totalAmount = data?.totalAmount ?? 0
  const acceptedCount = data?.acceptedCount ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        description="All job offers extended through the platform"
      >
        <Select value={decision} onValueChange={(v) => setDecision(v as DecisionFilter)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All decisions</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACCEPTED">Accepted</SelectItem>
            <SelectItem value="DECLINED">Declined</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total offers"
          value={total}
          icon={DollarSign}
          tone="info"
        />
        <StatCard
          label="Accepted"
          value={acceptedCount}
          icon={CheckCircle2}
          tone="success"
          hint={total > 0 ? `${Math.round((acceptedCount / total) * 100)}% acceptance rate` : undefined}
        />
        <StatCard
          label="Total compensation"
          value={formatCurrency(totalAmount, 'INR')}
          icon={Wallet}
          tone="brand"
          hint="Sum of all extended offers"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : isError ? (
            <ErrorState
              message={(error as Error)?.message ?? 'Failed to load offers'}
              onRetry={() => refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No offers extended yet"
              description="Offers extended from applications will be listed here."
            />
          ) : (
            <ScrollArea className="max-h-[70vh] scroll-area-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden md:table-cell">Role / Company</TableHead>
                    <TableHead>Compensation</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead className="hidden lg:table-cell">Expires</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((o) => (
                    <TableRow
                      key={o.id}
                      className="cursor-pointer"
                      onClick={() => navigate('officer/applications', { id: o.applicationId })}
                    >
                      <TableCell>
                        <button
                          className="text-left"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate('officer/students', { id: o.application.student.id })
                          }}
                        >
                          <div className="font-medium text-sm hover:underline">
                            {o.application.student.user.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                            {o.application.student.user.email}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm font-medium truncate max-w-[180px]">
                          {o.application.job.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {o.application.job.company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {o.amount != null
                          ? formatSalary(o.amount, null, o.currency ?? 'INR')
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={o.decision} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {o.expiresAt ? formatDate(o.expiresAt) : '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDateTime(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="size-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          {isFetching && rows.length > 0 && (
            <div className="p-2 text-xs text-muted-foreground text-center">Refreshing…</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
