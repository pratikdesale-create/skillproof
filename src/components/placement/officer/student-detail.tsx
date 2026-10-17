'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, ProgressRing,
  formatDate,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { SkillTag, EvidenceStatusBadge } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft, Mail, Phone, MapPin, GraduationCap, Github, Linkedin,
  Globe, ShieldCheck, FileText, Calendar, Target, Briefcase,
} from 'lucide-react'

interface StudentSkillRow {
  id: string
  skillId: string
  name: string
  category?: string | null
  selfRated?: string | null
  isVerified: boolean
  source?: string | null
  addedAt: string
}
interface StudentEvidenceRow {
  id: string
  type: string
  title: string
  status: string
  submittedAt: string
  sourceUrl?: string | null
  organization?: string | null
  score?: number | null
  maxScore?: number | null
}
interface EducationRow {
  id: string
  institution?: string | null
  degree?: string | null
  fieldOfStudy?: string | null
  startYear?: number | null
  endYear?: number | null
  cgpa?: number | null
  percentage?: number | null
}
interface AssessmentRow {
  id: string
  assessment?: { id: string; name: string; organization?: string | null; maxScore?: number | null } | null
  score?: number | null
  date?: string | null
}
interface ProjectRow {
  id: string
  title?: string | null
  description?: string | null
  link?: string | null
}
interface StudentDetailResponse {
  id: string
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  phone?: string | null
  studentId?: string | null
  university?: string | null
  batch?: string | null
  branch?: string | null
  cgpa?: number | null
  bio?: string | null
  location?: string | null
  linkedinUrl?: string | null
  githubUser?: string | null
  portfolioUrl?: string | null
  graduationYear?: number | null
  profileCompletion: number
  skills: StudentSkillRow[]
  evidence: StudentEvidenceRow[]
  education: EducationRow[]
  projects: ProjectRow[]
  assessmentResults: AssessmentRow[]
  applicationsCount: number
}

export function StudentDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const { data, isLoading, isError, error, refetch } = useQuery<StudentDetailResponse>({
    queryKey: ['officer-student', id],
    queryFn: () => apiGet<StudentDetailResponse>(`/api/students/${id}`),
    staleTime: 30_000,
  })

  if (isLoading) return <StudentDetailSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load student'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data) return <ErrorState message="Student not found" onRetry={() => refetch()} />

  const verifiedSkills = data.skills.filter((s) => s.isVerified)
  const evidenceByStatus = data.evidence.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        description={`${data.email}${data.batch ? ` · Batch ${data.batch}` : ''}${data.branch ? ` · ${data.branch}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('officer/students')}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('officer/applications', { studentId: data.id })}
        >
          <FileText className="size-4 mr-1" /> View applications{data.applicationsCount > 0 ? ` (${data.applicationsCount})` : ''}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('officer/ranking')}
        >
          <Target className="size-4 mr-1" /> Batch ranking
        </Button>
      </PageHeader>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {data.batch && <Badge variant="outline">Batch {data.batch}</Badge>}
                {data.branch && <Badge variant="outline" className="bg-muted/40">{data.branch}</Badge>}
                {data.cgpa != null && (
                  <Badge variant="outline" className="bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30">
                    CGPA {data.cgpa.toFixed(2)}
                  </Badge>
                )}
                {data.graduationYear && (
                  <Badge variant="outline" className="bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30">
                    Class of {data.graduationYear}
                  </Badge>
                )}
              </div>
              {data.bio && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {data.bio}
                </p>
              )}
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Mail className="size-3.5" /> {data.email}</div>
                {data.phone && (
                  <div className="flex items-center gap-2"><Phone className="size-3.5" /> {data.phone}</div>
                )}
                {data.location && (
                  <div className="flex items-center gap-2"><MapPin className="size-3.5" /> {data.location}</div>
                )}
                {data.university && (
                  <div className="flex items-center gap-2"><GraduationCap className="size-3.5" /> {data.university}</div>
                )}
                {data.githubUser && (
                  <a href={`https://github.com/${data.githubUser}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    <Github className="size-3.5" /> {data.githubUser}
                  </a>
                )}
                {data.linkedinUrl && (
                  <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    <Linkedin className="size-3.5" /> LinkedIn
                  </a>
                )}
                {data.portfolioUrl && (
                  <a href={data.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                    <Globe className="size-3.5" /> Portfolio
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center gap-4">
                <ProgressRing value={data.profileCompletion} size={64} strokeWidth={6} label="complete" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Profile completion</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {data.profileCompletion >= 90
                      ? 'Profile is complete and ready for recruiters.'
                      : data.profileCompletion >= 60
                      ? 'Good progress — add more details to stand out.'
                      : 'Add details, skills, and evidence to boost placement readiness.'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <StatPill label="Skills" value={data.skills.length} tone="info" />
                <StatPill label="Verified" value={verifiedSkills.length} tone="success" />
                <StatPill label="Evidence" value={data.evidence.length} />
                <StatPill label="Applications" value={data.applicationsCount} tone="info" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Skills */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> Skills
            </CardTitle>
            <CardDescription>
              {data.skills.length} total · {verifiedSkills.length} verified
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.skills.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No skills" description="Student has not added any skills yet" />
            ) : (
              <ScrollArea className="max-h-96 scroll-area-thin">
                <ul className="space-y-2">
                  {data.skills.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-start justify-between gap-2 rounded-md border p-2"
                    >
                      <div className="min-w-0">
                        <SkillTag name={s.name} isVerified={s.isVerified} />
                        {s.category && (
                          <div className="text-xs text-muted-foreground mt-1">{s.category}</div>
                        )}
                        {s.selfRated && (
                          <div className="text-xs text-muted-foreground">Self-rated: {s.selfRated}</div>
                        )}
                      </div>
                      {s.isVerified ? (
                        <Badge variant="outline" className="bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30 text-xs">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">
                          Unverified
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Evidence */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Evidence
            </CardTitle>
            <CardDescription>
              {data.evidence.length} item{data.evidence.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.evidence.length === 0 ? (
              <EmptyState icon={FileText} title="No evidence" description="Student has not submitted any evidence yet" />
            ) : (
              <ScrollArea className="max-h-96 scroll-area-thin">
                <ul className="divide-y">
                  {data.evidence.map((e) => (
                    <li
                      key={e.id}
                      className="p-3 hover:bg-muted/40 cursor-pointer"
                      onClick={() => navigate('officer/evidence', { id: e.id })}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{e.title}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                            {e.type.toLowerCase().replace(/_/g, ' ')}
                            {e.organization ? ` · ${e.organization}` : ''}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="size-3" />
                            {formatDate(e.submittedAt)}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <EvidenceStatusBadge status={e.status as never} />
                          {e.score != null && (
                            <Badge variant="outline" className="text-xs tabular-nums">
                              Score: {e.score}{e.maxScore != null ? `/${e.maxScore}` : ''}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Education + Assessments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="size-4" /> Education history
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.education.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No education records" description="Education history not provided" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead className="hidden md:table-cell">Degree</TableHead>
                    <TableHead>Years</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.education.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{e.institution ?? '—'}</div>
                        {e.fieldOfStudy && (
                          <div className="text-xs text-muted-foreground">{e.fieldOfStudy}</div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{e.degree ?? '—'}</TableCell>
                      <TableCell className="text-sm">
                        {e.startYear ?? '—'}{e.endYear ? `–${e.endYear}` : ''}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {e.cgpa != null ? `${e.cgpa.toFixed(2)}` :
                         e.percentage != null ? `${e.percentage}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="size-4" /> Assessment results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.assessmentResults.length === 0 ? (
              <EmptyState icon={Target} title="No assessments" description="No assessment results recorded" />
            ) : (
              <ScrollArea className="max-h-80 scroll-area-thin">
                <ul className="divide-y">
                  {data.assessmentResults.map((a) => (
                    <li key={a.id} className="p-3">
                      <div className="font-medium text-sm">
                        {a.assessment?.name ?? 'Assessment'}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {a.assessment?.organization ?? 'Unknown org'}
                        {a.date ? ` · ${formatDate(a.date)}` : ''}
                      </div>
                      {a.score != null && (
                        <Badge variant="outline" className="mt-2 text-xs tabular-nums">
                          Score: {a.score}{a.assessment?.maxScore != null ? `/${a.assessment.maxScore}` : ''}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Projects */}
      {data.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="size-4" /> Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.projects.map((p) => (
                <li key={p.id} className="rounded-md border p-3">
                  <div className="font-medium text-sm">{p.title ?? 'Untitled'}</div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{p.description}</p>
                  )}
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--info-foreground)] hover:underline mt-2 inline-flex items-center gap-1">
                      <Globe className="size-3" /> View project
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Evidence status summary */}
      {data.evidence.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence summary by status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(evidenceByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2 rounded-md border p-2">
                  <StatusBadge status={status} />
                  <span className="text-sm font-medium tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatPill({
  label, value, tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'info'
}) {
  const cls = tone === 'success'
    ? 'bg-[var(--verified-muted)] border-[var(--verified)]/30'
    : tone === 'info'
    ? 'bg-[var(--info-muted)] border-[var(--info)]/30'
    : 'bg-muted border-border'
  return (
    <div className={`rounded-md border p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-bold tabular-nums mt-0.5">{value}</div>
    </div>
  )
}

function StudentDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading student…" description="Hang tight" />
      <CardSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-40 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
