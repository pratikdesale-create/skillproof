'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate } from '@/components/placement/shared/ui'
import { FitScoreBadge, CoverageBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Target, ArrowRight, MapPin, Building2 } from 'lucide-react'

interface MatchRow {
  id: string
  jobId: string
  jobTitle: string
  company: { id: string; name: string; industry?: string | null }
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  missingSkillsCount: number
  updatedAt: string
}
interface MatchesResponse { data: MatchRow[] }

export function Matches() {
  const navigate = useAppStore(s => s.navigate)
  const [minScore, setMinScore] = useState(0)

  const { data, isLoading, isError, error, refetch } = useQuery<MatchesResponse>({
    queryKey: ['student-matches'],
    queryFn: () => apiGet<MatchesResponse>('/api/matches/student'),
    staleTime: 30_000,
  })

  const matches = useMemo(() => {
    const list = data?.data ?? []
    return list.filter(m => m.fitScore >= minScore)
  }, [data, minScore])

  if (isLoading) return <MatchesSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load matches'}
        onRetry={() => refetch()}
      />
    )
  }

  const all = data?.data ?? []
  const avgScore = all.length > 0
    ? all.reduce((sum, m) => sum + m.fitScore, 0) / all.length
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="My fit scores"
        description="Algorithm-computed match scores for every open job"
      />

      {/* Filter slider */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Minimum fit score</div>
              <div className="text-xs text-slate-500">Show only matches at or above this threshold</div>
            </div>
            <Badge variant="outline" className="text-base font-bold tabular-nums">
              {minScore.toFixed(0)}%
            </Badge>
          </div>
          <Slider
            value={[minScore]}
            onValueChange={(v) => setMinScore(v[0] ?? 0)}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{matches.length} of {all.length} matches shown</span>
            <span>Avg: {avgScore.toFixed(1)}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Matches list */}
      {matches.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Target}
              title={all.length === 0 ? 'No matches computed yet' : 'No matches at this threshold'}
              description={all.length === 0
                ? 'Add skills and evidence to start generating fit scores'
                : 'Lower the minimum fit score to see more results'}
              action={all.length === 0 ? (
                <Button size="sm" onClick={() => navigate('student/skills')}>Add skills</Button>
              ) : (
                <Button size="sm" onClick={() => setMinScore(0)}>Reset filter</Button>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[calc(100vh-20rem)]">
              <ul className="divide-y">
                {matches.map((m) => (
                  <li
                    key={m.id}
                    className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                    onClick={() => navigate(`student/jobs/${m.jobId}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium text-base">{m.jobTitle}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          <Building2 className="size-3" /> {m.company.name}
                          {m.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {m.location}
                            </span>
                          )}
                          {m.workArrangement && (
                            <Badge variant="outline" className="text-xs capitalize">{m.workArrangement}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <CoverageBadge value={m.requiredCoverage} />
                          <Badge variant="outline" className="text-xs">
                            {m.missingSkillsCount} missing skill{m.missingSkillsCount === 1 ? '' : 's'}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            updated {formatDate(m.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <FitScoreBadge score={m.fitScore} className="text-base" />
                        <Button size="sm" variant="outline">
                          View <ArrowRight className="size-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MatchesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="My fit scores" description="Loading matches…" />
      <Card><CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent></Card>
      <Card>
        <CardContent className="p-6 space-y-3">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    </div>
  )
}
