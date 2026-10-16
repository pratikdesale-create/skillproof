'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, CardSkeleton, EmptyState, ErrorState, formatDateTime } from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft, Download, ShieldCheck, RefreshCw, ExternalLink, Mail, Phone,
  MapPin, Linkedin, Github, Globe, FileText, AlertTriangle, CheckCircle2,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AuthUser, StudentProfile, ClaimStatus } from '@/types'

interface ResumeEvidenceRef {
  id: string
  title: string
  type: string
  status: string
  sourceUrl?: string | null
  organization?: string | null
}

interface ResumeBullet {
  id: string
  section: string
  text: string
  skillIds: string[]
  evidenceIds: string[]
  claimStatus: ClaimStatus
  orderIndex: number
  evidence?: ResumeEvidenceRef[]
}

interface ResumeDetailData {
  id: string
  title: string
  version: number
  jobId?: string | null
  job?: { id: string; title: string } | null
  isGenerated: boolean
  summary?: string | null
  bullets: ResumeBullet[]
  createdAt: string
  updatedAt: string
}

interface ValidationSummary {
  totalBullets: number
  supported: number
  unsupported: number
  needsReview: number
  unverifiedEvidenceCount: number
}

interface ValidationBullet extends ResumeBullet {
  missingEvidenceNote?: string | null
  unverifiedEvidenceNote?: string | null
}

interface ValidationResponse {
  resumeId: string
  title: string
  summary: ValidationSummary
  bullets: ValidationBullet[]
}

interface MeResponse {
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
}

const SECTION_ORDER = ['education', 'skills', 'experience', 'projects', 'certifications'] as const
const SECTION_LABELS: Record<string, string> = {
  education: 'Education',
  skills: 'Technical Skills',
  experience: 'Experience & Achievements',
  projects: 'Projects',
  certifications: 'Certifications',
}

export function ResumeDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const meQuery = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/me'),
    staleTime: 60_000,
  })
  const resumeQuery = useQuery<ResumeDetailData>({
    queryKey: ['resume', id],
    queryFn: () => apiGet<ResumeDetailData>(`/api/resumes/${id}`),
    staleTime: 60_000,
  })

  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [showValidation, setShowValidation] = useState(false)

  const validateMutation = useMutation({
    mutationFn: () => apiGet<ValidationResponse>(`/api/resumes/${id}/validate`),
    onSuccess: (data) => {
      setValidation(data)
      setShowValidation(true)
      toast.success('Claims validated')
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to validate claims')
    },
  })

  const regenerateMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {}
      if (resumeQuery.data?.jobId) body.jobId = resumeQuery.data.jobId
      return apiPost<{ id: string }>('/api/resumes/generate', body)
    },
    onSuccess: (resp) => {
      toast.success('Resume regenerated')
      qc.invalidateQueries({ queryKey: ['resumes'] })
      if (resp?.id) navigate(`student/resumes/${resp.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to regenerate')
    },
  })

  const loading = meQuery.isLoading || resumeQuery.isLoading
  const loadErr = (resumeQuery.error as Error) ?? (meQuery.error as Error)

  if (loading) return <ResumeDetailSkeleton />
  if (loadErr) {
    return (
      <ErrorState
        message={loadErr.message ?? 'Failed to load resume'}
        onRetry={() => { resumeQuery.refetch(); meQuery.refetch() }}
      />
    )
  }
  if (!resumeQuery.data) {
    return <ErrorState message="Resume not found" onRetry={() => resumeQuery.refetch()} />
  }

  const resume = resumeQuery.data
  const user = meQuery.data?.user
  const profile = meQuery.data?.profile

  // Group bullets by section
  const bulletsBySection = new Map<string, ResumeBullet[]>()
  for (const b of resume.bullets) {
    const arr = bulletsBySection.get(b.section) ?? []
    arr.push(b)
    bulletsBySection.set(b.section, arr)
  }
  const sections = Array.from(bulletsBySection.entries())
    .sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a[0] as typeof SECTION_ORDER[number])
      const bi = SECTION_ORDER.indexOf(b[0] as typeof SECTION_ORDER[number])
      const aIdx = ai === -1 ? 99 : ai
      const bIdx = bi === -1 ? 99 : bi
      return aIdx - bIdx
    })

  // Contact line building
  const contactItems: Array<{ icon: React.ReactNode; value: string; href?: string }> = []
  if (user?.email) contactItems.push({ icon: <Mail className="size-3" />, value: user.email, href: `mailto:${user.email}` })
  if (user?.phone) contactItems.push({ icon: <Phone className="size-3" />, value: user.phone })
  if (profile?.location) contactItems.push({ icon: <MapPin className="size-3" />, value: profile.location })
  if (profile?.linkedinUrl) contactItems.push({ icon: <Linkedin className="size-3" />, value: 'LinkedIn', href: profile.linkedinUrl })
  if (profile?.githubUser) contactItems.push({ icon: <Github className="size-3" />, value: profile.githubUser, href: `https://github.com/${profile.githubUser}` })
  if (profile?.portfolioUrl) contactItems.push({ icon: <Globe className="size-3" />, value: 'Portfolio', href: profile.portfolioUrl })

  return (
    <div className="space-y-6">
      <PageHeader
        title={resume.title}
        description={`Version ${resume.version} · ${resume.job?.title ? `Targeted for ${resume.job.title}` : 'General resume'}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('student/resumes')}>
          <ArrowLeft className="size-4 mr-1" /> All resumes
        </Button>
        <a href={`/api/resumes/${resume.id}/pdf?download=1`} target="_blank" rel="noopener noreferrer">
          <Button size="sm">
            <Download className="size-4 mr-2" /> Download PDF
          </Button>
        </a>
        <Button variant="outline" size="sm" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>
          {validateMutation.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Validating…</> : <><ShieldCheck className="size-4 mr-2" /> Validate claims</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => regenerateMutation.mutate()} disabled={regenerateMutation.isPending}>
          {regenerateMutation.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" /> Regenerating…</> : <><RefreshCw className="size-4 mr-2" /> Regenerate</>}
        </Button>
      </PageHeader>

      {/* Resume preview */}
      <Card className="bg-white dark:bg-slate-950">
        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Header */}
          <header className="text-center border-b pb-4">
            <h1 className="text-2xl font-bold tracking-tight">{user?.name ?? 'Your Name'}</h1>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 mt-2">
              {contactItems.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {c.icon}
                  {c.href ? (
                    <a href={c.href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {c.value}
                    </a>
                  ) : (
                    c.value
                  )}
                </span>
              ))}
            </div>
          </header>

          {/* Summary */}
          {resume.summary && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1 mb-2">
                Professional Summary
              </h2>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {resume.summary}
              </p>
            </section>
          )}

          {/* Sections */}
          {sections.map(([section, bullets]) => (
            <section key={section}>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b pb-1 mb-2">
                {SECTION_LABELS[section] ?? section}
              </h2>
              <ul className="space-y-1.5">
                {bullets.map((b) => (
                  <li key={b.id} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-4 relative">
                    <span className="absolute left-0 top-2 size-1 rounded-full bg-slate-400" />
                    {b.text}
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <StatusBadge status={b.claimStatus} className="text-xs" />
                      {b.skillIds.length > 0 && section === 'skills' && (
                        <span className="text-xs text-slate-500">
                          {b.skillIds.length} skill id{b.skillIds.length === 1 ? '' : 's'} linked
                        </span>
                      )}
                      {b.evidence && b.evidence.length > 0 && (
                        <span className="text-xs text-slate-500">
                          Evidence: {b.evidence.map((e, i) => (
                            <span key={e.id}>
                              {i > 0 && ', '}
                              <span className="text-slate-600 dark:text-slate-400 underline" title={e.title}>
                                {e.title}
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>

      {/* Validation panel */}
      {showValidation && validation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> Claim validation
            </CardTitle>
            <CardDescription>Per-bullet evidence check</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ValidationStat
                label="Total bullets"
                value={validation.summary.totalBullets}
                icon={<FileText className="size-4" />}
                tone="default"
              />
              <ValidationStat
                label="Supported"
                value={validation.summary.supported}
                icon={<CheckCircle2 className="size-4" />}
                tone="success"
              />
              <ValidationStat
                label="Unsupported"
                value={validation.summary.unsupported}
                icon={<AlertTriangle className="size-4" />}
                tone="danger"
              />
              <ValidationStat
                label="Pending evidence"
                value={validation.summary.unverifiedEvidenceCount}
                icon={<Loader2 className="size-4" />}
                tone="warning"
              />
            </div>

            {/* Bullets */}
            <ScrollArea className="max-h-96">
              <ul className="divide-y">
                {validation.bullets.map((b) => (
                  <li key={b.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <StatusBadge status={b.claimStatus} className="shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300">{b.text}</p>
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <Badge variant="outline" className="text-xs capitalize">{b.section}</Badge>
                          {b.evidence && b.evidence.length > 0 ? (
                            b.evidence.map(e => (
                              <span key={e.id} className="flex items-center gap-1">
                                <FileText className="size-3" />
                                <span className="text-slate-600 dark:text-slate-400">{e.title}</span>
                                <StatusBadge status={e.status} className="text-xs" />
                              </span>
                            ))
                          ) : (
                            <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> No linked evidence
                            </span>
                          )}
                        </div>
                        {b.missingEvidenceNote && (
                          <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 rounded p-2">
                            <AlertTriangle className="size-3 inline mr-1" />
                            {b.missingEvidenceNote}
                          </p>
                        )}
                        {b.unverifiedEvidenceNote && (
                          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded p-2">
                            <AlertTriangle className="size-3 inline mr-1" />
                            {b.unverifiedEvidenceNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 text-xs text-slate-500 border-t pt-4">
        <ExternalLink className="size-3.5" />
        Tip — open the PDF in a new tab to share with recruiters. The PDF marks unverified bullets clearly.
      </div>
    </div>
  )
}

function ValidationStat({
  label, value, icon, tone,
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone: 'default' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<string, string> = {
    default: 'border-slate-200 dark:border-slate-800',
    success: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900',
    danger: 'border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900',
  }
  return (
    <div className={`rounded-md border p-3 ${tones[tone]}`}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-500">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  )
}

function ResumeDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading resume…" description="Hang tight" />
      <Card>
        <CardContent className="p-8 space-y-3">
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-3 w-3/4 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
