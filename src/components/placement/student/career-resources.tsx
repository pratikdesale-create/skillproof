'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, SectionHeader,
} from '@/components/placement/shared/ui'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ExternalLink, GraduationCap, BookOpen, Clock, FileText, Video, Code2,
  Info, ArrowRight,
} from 'lucide-react'

interface CuratedResource {
  skillName: string
  skillDisplayName: string
  category: string
  resourceType: 'course' | 'docs' | 'practice' | 'video'
  title: string
  provider: string
  url: string
  duration: string
  notes: string
}
interface Recommendation {
  skill: { id: string; displayName: string; canonicalName: string; category?: string | null }
  gapFrequency: number
  resources: CuratedResource[]
}
interface CareerArticle {
  id: string
  title: string
  category: string
  duration: string
  source: string
  summary: string
}
interface CareerResourcesResponse {
  recommendations: Recommendation[]
  careerArticles: CareerArticle[]
  totalGaps: number
  curatedGaps: number
}

const RESOURCE_TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  course: { label: 'Course', icon: GraduationCap },
  docs: { label: 'Docs', icon: FileText },
  practice: { label: 'Practice', icon: Code2 },
  video: { label: 'Video', icon: Video },
}

export function CareerResources() {
  const navigate = useAppStore(s => s.navigate)
  const { data, isLoading, isError, error, refetch } = useQuery<CareerResourcesResponse>({
    queryKey: ['career-resources'],
    queryFn: () => apiGet<CareerResourcesResponse>('/api/career-resources'),
    staleTime: 60_000,
  })

  if (isLoading) return <CareerResourcesSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load career resources'}
        onRetry={() => refetch()}
      />
    )
  }

  const recommendations = data?.recommendations ?? []
  const articles = data?.careerArticles ?? []
  const totalGaps = data?.totalGaps ?? 0
  const curatedGaps = data?.curatedGaps ?? 0
  const hasGaps = totalGaps > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career Resources"
        description="Curated learning paths for your skill gaps and career-readiness reads"
      />

      {/* Microcopy notice */}
      <div className="rounded-md border border-[var(--info)]/30 bg-[var(--info-muted)] p-3 flex items-start gap-2 text-xs text-[var(--info-foreground)]">
        <Info className="size-4 shrink-0 mt-0.5" />
        <p>
          Recommendations are based on actual skill gaps detected in your match results.
          Completing a resource does <span className="font-semibold">NOT</span> verify a skill — submit evidence after completion on the Skills page.
        </p>
      </div>

      {/* Top section: skill gap recommendations */}
      <div>
        <SectionHeader
          title="Recommended for your skill gaps"
          description={
            hasGaps
              ? `${totalGaps} gap${totalGaps === 1 ? '' : 's'} detected · ${curatedGaps} with curated resources`
              : 'No critical skill gaps detected'
          }
        />

        {!hasGaps ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={BookOpen}
                title="Your profile is well-aligned with available roles"
                description="No critical skill gaps detected in your match results. Browse jobs to find your next opportunity."
                action={
                  <Button size="sm" onClick={() => navigate('student/jobs')}>
                    Browse jobs <ArrowRight className="size-3 ml-1" />
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : recommendations.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={BookOpen}
                title="No curated resources for your gaps yet"
                description="We detected gaps but haven't curated learning resources for them. Try submitting evidence (projects, certifications) to back those skills."
                action={
                  <Button size="sm" onClick={() => navigate('student/skills')}>
                    Manage skills
                  </Button>
                }
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <Card key={rec.skill.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                        <SkillTag name={rec.skill.displayName} isRequired />
                        <Badge variant="outline" className="text-xs">
                          {rec.gapFrequency} role{rec.gapFrequency === 1 ? '' : 's'} need this
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Curated {rec.resources.length} resource{rec.resources.length === 1 ? '' : 's'} to build this skill
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rec.resources.map((r, i) => {
                      const meta = RESOURCE_TYPE_META[r.resourceType] ?? RESOURCE_TYPE_META.docs
                      const Icon = meta.icon
                      return (
                        <li key={i} className="rounded-md border p-3 flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-xs gap-1">
                              <Icon className="size-3" /> {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="size-3" /> {r.duration}
                            </span>
                          </div>
                          <div className="font-medium text-sm text-foreground">{r.title}</div>
                          <div className="text-xs text-muted-foreground">{r.provider}</div>
                          {r.notes && (
                            <p className="text-xs text-muted-foreground leading-relaxed">{r.notes}</p>
                          )}
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            <ExternalLink className="size-3" /> Open resource
                          </a>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bottom section: career articles */}
      <div>
        <SectionHeader
          title="Career articles"
          description="Short reads on resumes, interviews, and profile polish"
        />
        {articles.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={BookOpen}
                title="No articles available"
                description="Career-readiness guides will appear here when published."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map((a) => (
              <Card key={a.id} className="flex flex-col hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{a.category}</Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="size-3" /> {a.duration}
                    </span>
                  </div>
                  <CardTitle className="text-base mt-2">{a.title}</CardTitle>
                  <CardDescription className="text-xs">{a.source}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{a.summary}</p>
                  <div className="mt-auto pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Guide stub</span>
                    <a
                      href="#"
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                      onClick={(e) => e.preventDefault()}
                      aria-disabled="true"
                    >
                      <BookOpen className="size-3" /> Read
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Info className="size-3" />
          Article links are placeholders in this MVP — full guides will be available in a future release.
        </p>
      </div>
    </div>
  )
}

function CareerResourcesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Career Resources" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
