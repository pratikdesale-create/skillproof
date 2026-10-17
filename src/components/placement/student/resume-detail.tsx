'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  SectionHeader, formatDateTime,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  ArrowLeft, Download, ShieldCheck, RefreshCw, ExternalLink, Mail, Phone,
  MapPin, Linkedin, Github, Globe, FileText, AlertTriangle, CheckCircle2,
  Loader2, Pencil, Eye, ListChecks, GraduationCap, Briefcase, Award, Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  education: GraduationCap,
  skills: FileText,
  experience: Briefcase,
  projects: FileText,
  certifications: Award,
  summary: Sparkles,
}

type QualityStatus = 'pass' | 'warn' | 'fail'

interface QualityCheck {
  label: string
  status: QualityStatus
  detail: string
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

  const validateMutation = useMutation({
    mutationFn: () => apiGet<ValidationResponse>(`/api/resumes/${id}/validate`),
    onSuccess: (data) => {
      setValidation(data)
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

  return (
    <ResumeEditor
      key={resume.id}
      resume={resume}
      user={user ?? null}
      profile={profile ?? null}
      validation={validation}
      onValidate={() => validateMutation.mutate()}
      validating={validateMutation.isPending}
      onRegenerate={() => regenerateMutation.mutate()}
      regenerating={regenerateMutation.isPending}
    />
  )
}

interface EditorState {
  summary: string
  bullets: Record<string, string> // bulletId -> edited text
}

function ResumeEditor({
  resume, user, profile, validation, onValidate, validating, onRegenerate, regenerating,
}: {
  resume: ResumeDetailData
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
  validation: ValidationResponse | null
  onValidate: () => void
  validating: boolean
  onRegenerate: () => void
  regenerating: boolean
}) {
  const navigate = useAppStore(s => s.navigate)

  const [state, setState] = useState<EditorState>({
    summary: resume.summary ?? '',
    bullets: Object.fromEntries(resume.bullets.map(b => [b.id, b.text])),
  })

  // Group bullets by section, preserving order
  const bulletsBySection = useMemo(() => {
    const map = new Map<string, ResumeBullet[]>()
    for (const b of resume.bullets) {
      const arr = map.get(b.section) ?? []
      arr.push(b)
      map.set(b.section, arr)
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ai = SECTION_ORDER.indexOf(a[0] as typeof SECTION_ORDER[number])
      const bi = SECTION_ORDER.indexOf(b[0] as typeof SECTION_ORDER[number])
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })
  }, [resume.bullets])

  // Build live preview from edited state
  const previewBullets = resume.bullets.map(b => ({
    ...b,
    text: state.bullets[b.id] ?? b.text,
  }))

  // Compute deterministic quality checks (no fake scores)
  const qualityChecks = useMemo<QualityCheck[]>(() => {
    const checks: QualityCheck[] = []

    // 1. Missing contact info
    const missingContact: string[] = []
    if (!user?.email) missingContact.push('email')
    if (!user?.phone) missingContact.push('phone')
    if (!profile?.location) missingContact.push('location')
    if (!profile?.linkedinUrl) missingContact.push('LinkedIn')
    if (missingContact.length > 0) {
      checks.push({
        label: 'Contact info',
        status: missingContact.length >= 3 ? 'fail' : 'warn',
        detail: `Missing: ${missingContact.join(', ')}. Recruiters use these to reach you — add them in Settings.`,
      })
    } else {
      checks.push({ label: 'Contact info', status: 'pass', detail: 'All key contact fields present.' })
    }

    // 2. Missing relevant skills
    const skillsBullets = resume.bullets.filter(b => b.section === 'skills')
    if (skillsBullets.length === 0) {
      checks.push({
        label: 'Relevant skills',
        status: 'fail',
        detail: 'No skills section. Add verified skills on the Skills page before generating.',
      })
    } else if (skillsBullets.length < 3) {
      checks.push({
        label: 'Relevant skills',
        status: 'warn',
        detail: `Only ${skillsBullets.length} skill bullet${skillsBullets.length === 1 ? '' : 's'}. Add more verified skills to strengthen your profile.`,
      })
    } else {
      checks.push({ label: 'Relevant skills', status: 'pass', detail: `${skillsBullets.length} skill bullets listed.` })
    }

    // 3. Long bullet points (>200 chars)
    const longBullets = resume.bullets.filter(b => b.text.length > 200)
    if (longBullets.length > 0) {
      checks.push({
        label: 'Bullet length',
        status: 'warn',
        detail: `${longBullets.length} bullet${longBullets.length === 1 ? '' : 's'} exceed 200 characters. Tighten them for scannability.`,
      })
    } else {
      checks.push({ label: 'Bullet length', status: 'pass', detail: 'All bullets are concise (≤200 chars).' })
    }

    // 4. Unsupported factual claims
    const unsupported = resume.bullets.filter(b => b.claimStatus === 'UNSUPPORTED')
    if (unsupported.length > 0) {
      checks.push({
        label: 'Factual claims',
        status: 'fail',
        detail: `${unsupported.length} bullet${unsupported.length === 1 ? '' : 's'} have no verified evidence. Recruiters will see them marked as unsupported.`,
      })
    } else {
      checks.push({ label: 'Factual claims', status: 'pass', detail: 'All factual claims are backed by verified evidence.' })
    }

    // 5. Relevance to selected job
    if (!resume.jobId) {
      checks.push({
        label: 'Job relevance',
        status: 'warn',
        detail: 'General resume — not targeted to a specific role. Generate a job-specific version for higher fit.',
      })
    } else {
      checks.push({
        label: 'Job relevance',
        status: 'pass',
        detail: `Targeted to ${resume.job?.title ?? 'a specific role'}.`,
      })
    }

    // 6. Missing evidence links
    const noEvidence = resume.bullets.filter(b => b.section !== 'skills' && (b.evidenceIds?.length ?? 0) === 0)
    if (noEvidence.length > 0) {
      checks.push({
        label: 'Evidence links',
        status: 'warn',
        detail: `${noEvidence.length} bullet${noEvidence.length === 1 ? '' : 's'} have no linked evidence. Attach proof to support each claim.`,
      })
    } else if (resume.bullets.length > 0) {
      checks.push({ label: 'Evidence links', status: 'pass', detail: 'All non-skill bullets reference evidence.' })
    }

    return checks
  }, [resume, user, profile])

  const passCount = qualityChecks.filter(c => c.status === 'pass').length
  const warnCount = qualityChecks.filter(c => c.status === 'warn').length
  const failCount = qualityChecks.filter(c => c.status === 'fail').length

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
        <Button variant="outline" size="sm" onClick={onValidate} disabled={validating}>
          {validating ? <><Loader2 className="size-4 mr-2 animate-spin" /> Validating…</> : <><ShieldCheck className="size-4 mr-2" /> Validate claims</>}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={regenerating}>
          {regenerating ? <><Loader2 className="size-4 mr-2 animate-spin" /> Regenerating…</> : <><RefreshCw className="size-4 mr-2" /> Regenerate</>}
        </Button>
      </PageHeader>

      {/* Quality checks panel — deterministic, no fake scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <ListChecks className="size-4" /> Quality checks
            </span>
            <div className="flex items-center gap-2 text-xs">
              {passCount > 0 && <Badge className="bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30">{passCount} pass</Badge>}
              {warnCount > 0 && <Badge className="bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30">{warnCount} warn</Badge>}
              {failCount > 0 && <Badge className="bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30">{failCount} fail</Badge>}
            </div>
          </CardTitle>
          <CardDescription>
            Deterministic checklist — no machine scoring. Fix warnings to improve recruiter trust.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {qualityChecks.map((c, i) => (
              <li
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-md border p-3 text-sm',
                  c.status === 'pass' && 'border-[var(--verified)]/30 bg-[var(--verified-muted)]',
                  c.status === 'warn' && 'border-[var(--pending)]/30 bg-[var(--pending-muted)]',
                  c.status === 'fail' && 'border-[var(--danger)]/30 bg-[var(--danger-muted)]',
                )}
              >
                {c.status === 'pass'
                  ? <CheckCircle2 className="size-4 text-[var(--verified-foreground)] shrink-0 mt-0.5" />
                  : c.status === 'warn'
                  ? <AlertTriangle className="size-4 text-[var(--pending-foreground)] shrink-0 mt-0.5" />
                  : <AlertTriangle className="size-4 text-[var(--danger-foreground)] shrink-0 mt-0.5" />}
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{c.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Mobile tabs: Editor / Preview / Validation */}
      <div className="lg:hidden">
        <Tabs defaultValue="editor">
          <TabsList className="w-full">
            <TabsTrigger value="editor" className="flex-1"><Pencil className="size-3.5 mr-1" /> Editor</TabsTrigger>
            <TabsTrigger value="preview" className="flex-1"><Eye className="size-3.5 mr-1" /> Preview</TabsTrigger>
            {validation && <TabsTrigger value="validation" className="flex-1"><ShieldCheck className="size-3.5 mr-1" /> Claims</TabsTrigger>}
          </TabsList>
          <TabsContent value="editor" className="mt-4">
            <EditorPane
              resume={resume}
              user={user}
              profile={profile}
              state={state}
              setState={setState}
              bulletsBySection={bulletsBySection}
              validation={validation}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <PreviewPane
              resume={resume}
              user={user}
              profile={profile}
              summary={state.summary}
              previewBullets={previewBullets}
            />
          </TabsContent>
          {validation && (
            <TabsContent value="validation" className="mt-4">
              <ValidationPanel validation={validation} />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Desktop: split editor / preview */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Editor" description="Local edits only — Regenerate to bake in changes." />
          <EditorPane
            resume={resume}
            user={user}
            profile={profile}
            state={state}
            setState={setState}
            bulletsBySection={bulletsBySection}
            validation={validation}
          />
        </div>
        <div>
          <SectionHeader title="Live preview" description="Updates as you edit" />
          <PreviewPane
            resume={resume}
            user={user}
            profile={profile}
            summary={state.summary}
            previewBullets={previewBullets}
          />
          {validation && (
            <div className="mt-6">
              <SectionHeader title="Claim validation" description="Per-bullet evidence check" />
              <ValidationPanel validation={validation} />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-4">
        <ExternalLink className="size-3.5" />
        Tip — open the PDF in a new tab to share with recruiters. The PDF marks unverified bullets clearly. Editor changes are preview-only in this MVP.
      </div>
    </div>
  )
}

// ============== Editor pane ==============

function EditorPane({
  resume, user, profile, state, setState, bulletsBySection, validation,
}: {
  resume: ResumeDetailData
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
  state: EditorState
  setState: React.Dispatch<React.SetStateAction<EditorState>>
  bulletsBySection: Array<[string, ResumeBullet[]]>
  validation: ValidationResponse | null
}) {
  const navigate = useAppStore(s => s.navigate)

  const contactItems: Array<{ label: string; value: string | null; href?: string }> = [
    { label: 'Email', value: user?.email ?? null, href: user?.email ? `mailto:${user.email}` : undefined },
    { label: 'Phone', value: user?.phone ?? null },
    { label: 'Location', value: profile?.location ?? null },
    { label: 'LinkedIn', value: profile?.linkedinUrl ?? null, href: profile?.linkedinUrl ?? undefined },
    { label: 'GitHub', value: profile?.githubUser ?? null, href: profile?.githubUser ? `https://github.com/${profile.githubUser}` : undefined },
    { label: 'Portfolio', value: profile?.portfolioUrl ?? null, href: profile?.portfolioUrl ?? undefined },
  ]

  return (
    <Card>
      <CardContent className="p-4 space-y-5">
        {/* Read-only identity */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
              <FileText className="size-3.5" /> Identity
            </h3>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => navigate('student/settings')}>
              <Pencil className="size-3 mr-1" /> Edit in Settings
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ReadonlyField label="Full name" value={user?.name ?? ''} />
            <ReadonlyField label="Email" value={user?.email ?? ''} />
          </div>
        </section>

        {/* Contact (read-only display) */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5" /> Contact
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {contactItems.map((c, i) => (
              <li key={i} className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <div className="text-muted-foreground">{c.label}</div>
                <div className="font-medium text-foreground truncate">{c.value || '—'}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Education (read-only from profile) */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <GraduationCap className="size-3.5" /> Education
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <ReadonlyField label="University" value={profile?.university ?? ''} />
            <ReadonlyField label="Branch" value={profile?.branch ?? ''} />
            <ReadonlyField label="Batch" value={profile?.batch ?? ''} />
            <ReadonlyField label="Graduation year" value={profile?.graduationYear?.toString() ?? ''} />
            <ReadonlyField label="CGPA" value={profile?.cgpa?.toString() ?? ''} />
          </div>
        </section>

        {/* Summary (editable) */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5" /> Professional summary
          </h3>
          <Textarea
            rows={4}
            value={state.summary}
            onChange={(e) => setState(s => ({ ...s, summary: e.target.value }))}
            placeholder="A short professional summary — your strengths, interests, and career goals."
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground">{state.summary.length}/1000</p>
        </section>

        {/* Bullets by section (editable) */}
        {bulletsBySection.map(([section, bullets]) => {
          const SectionIcon = SECTION_ICONS[section] ?? FileText
          return (
            <section key={section} className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1.5">
                <SectionIcon className="size-3.5" /> {SECTION_LABELS[section] ?? section}
                <Badge variant="outline" className="text-xs ml-auto">{bullets.length}</Badge>
              </h3>
              <ul className="space-y-3">
                {bullets.map((b) => {
                  const editedText = state.bullets[b.id] ?? b.text
                  const claimValid = validation?.bullets.find((vb) => vb.id === b.id)
                  return (
                    <li key={b.id} className="rounded-md border p-3 space-y-2 bg-card">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={b.claimStatus} size="sm" />
                        {(b.evidenceIds?.length ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {b.evidenceIds.length} evidence
                          </Badge>
                        )}
                        {b.skillIds.length > 0 && section === 'skills' && (
                          <Badge variant="outline" className="text-xs">
                            {b.skillIds.length} skill id{b.skillIds.length === 1 ? '' : 's'}
                          </Badge>
                        )}
                      </div>
                      <Textarea
                        rows={Math.min(6, Math.max(2, Math.ceil(editedText.length / 70)))}
                        value={editedText}
                        onChange={(e) => setState(s => ({
                          ...s,
                          bullets: { ...s.bullets, [b.id]: e.target.value },
                        }))}
                        className="text-sm"
                      />
                      {b.evidence && b.evidence.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-muted-foreground">Evidence:</span>
                          {b.evidence.map(e => (
                            <Badge key={e.id} variant="outline" className="text-xs gap-1">
                              <FileText className="size-3" />
                              {e.title}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {claimValid?.missingEvidenceNote && (
                        <div className="text-xs text-[var(--danger-foreground)] bg-[var(--danger-muted)] border border-[var(--danger)]/30 rounded p-2">
                          <AlertTriangle className="size-3 inline mr-1" />
                          {claimValid.missingEvidenceNote}
                        </div>
                      )}
                      {claimValid?.unverifiedEvidenceNote && (
                        <div className="text-xs text-[var(--pending-foreground)] bg-[var(--pending-muted)] border border-[var(--pending)]/30 rounded p-2">
                          <AlertTriangle className="size-3 inline mr-1" />
                          {claimValid.unverifiedEvidenceNote}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground truncate">{value || '—'}</div>
    </div>
  )
}

// ============== Preview pane ==============

function PreviewPane({
  resume, user, profile, summary, previewBullets,
}: {
  resume: ResumeDetailData
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
  summary: string
  previewBullets: ResumeBullet[]
}) {
  const contactItems: Array<{ icon: React.ReactNode; value: string; href?: string }> = []
  if (user?.email) contactItems.push({ icon: <Mail className="size-3" />, value: user.email, href: `mailto:${user.email}` })
  if (user?.phone) contactItems.push({ icon: <Phone className="size-3" />, value: user.phone })
  if (profile?.location) contactItems.push({ icon: <MapPin className="size-3" />, value: profile.location })
  if (profile?.linkedinUrl) contactItems.push({ icon: <Linkedin className="size-3" />, value: 'LinkedIn', href: profile.linkedinUrl })
  if (profile?.githubUser) contactItems.push({ icon: <Github className="size-3" />, value: profile.githubUser, href: `https://github.com/${profile.githubUser}` })
  if (profile?.portfolioUrl) contactItems.push({ icon: <Globe className="size-3" />, value: 'Portfolio', href: profile.portfolioUrl })

  // Group preview bullets by section
  const bulletsBySection = new Map<string, ResumeBullet[]>()
  for (const b of previewBullets) {
    const arr = bulletsBySection.get(b.section) ?? []
    arr.push(b)
    bulletsBySection.set(b.section, arr)
  }
  const sections = Array.from(bulletsBySection.entries()).sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a[0] as typeof SECTION_ORDER[number])
    const bi = SECTION_ORDER.indexOf(b[0] as typeof SECTION_ORDER[number])
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <Card className="bg-white">
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Header */}
        <header className="text-center border-b pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{user?.name ?? 'Your Name'}</h1>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
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
        {summary && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
              Professional Summary
            </h2>
            <p className="text-sm leading-relaxed text-foreground/90">
              {summary}
            </p>
          </section>
        )}

        {/* Sections */}
        {sections.map(([section, bullets]) => (
          <section key={section}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2">
              {SECTION_LABELS[section] ?? section}
            </h2>
            <ul className="space-y-1.5">
              {bullets.map((b) => (
                <li key={b.id} className="text-sm text-foreground/90 leading-relaxed pl-4 relative">
                  <span className="absolute left-0 top-2 size-1 rounded-full bg-muted-foreground/60" />
                  {b.text}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
                    <StatusBadge status={b.claimStatus} size="sm" />
                    {b.evidence && b.evidence.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Evidence: {b.evidence.map((e, i) => (
                          <span key={e.id}>
                            {i > 0 && ', '}
                            <span className="text-muted-foreground underline" title={e.title}>
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
  )
}

// ============== Validation panel ==============

function ValidationPanel({ validation }: { validation: ValidationResponse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="size-4" /> Claim validation
        </CardTitle>
        <CardDescription>Per-bullet evidence check</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ValidationStat label="Total bullets" value={validation.summary.totalBullets} tone="default" />
          <ValidationStat label="Supported" value={validation.summary.supported} tone="success" />
          <ValidationStat label="Unsupported" value={validation.summary.unsupported} tone="danger" />
          <ValidationStat label="Pending evidence" value={validation.summary.unverifiedEvidenceCount} tone="warning" />
        </div>
        <ScrollArea className="max-h-96 scroll-area-thin">
          <ul className="divide-y">
            {validation.bullets.map((b) => (
              <li key={b.id} className="py-3">
                <div className="flex items-start gap-3">
                  <StatusBadge status={b.claimStatus} className="shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm text-foreground/90">{b.text}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <Badge variant="outline" className="text-xs capitalize">{b.section}</Badge>
                      {b.evidence && b.evidence.length > 0 ? (
                        b.evidence.map(e => (
                          <span key={e.id} className="flex items-center gap-1">
                            <FileText className="size-3" />
                            <span className="text-muted-foreground">{e.title}</span>
                            <StatusBadge status={e.status} size="sm" />
                          </span>
                        ))
                      ) : (
                        <span className="text-[var(--danger-foreground)] flex items-center gap-1">
                          <AlertTriangle className="size-3" /> No linked evidence
                        </span>
                      )}
                    </div>
                    {b.missingEvidenceNote && (
                      <p className="text-xs text-[var(--danger-foreground)] bg-[var(--danger-muted)] border border-[var(--danger)]/30 rounded p-2">
                        <AlertTriangle className="size-3 inline mr-1" />
                        {b.missingEvidenceNote}
                      </p>
                    )}
                    {b.unverifiedEvidenceNote && (
                      <p className="text-xs text-[var(--pending-foreground)] bg-[var(--pending-muted)] border border-[var(--pending)]/30 rounded p-2">
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
  )
}

function ValidationStat({
  label, value, tone,
}: {
  label: string
  value: number
  tone: 'default' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<string, string> = {
    default: 'border-border',
    success: 'border-[var(--verified)]/30 bg-[var(--verified-muted)]',
    warning: 'border-[var(--pending)]/30 bg-[var(--pending-muted)]',
    danger: 'border-[var(--danger)]/30 bg-[var(--danger-muted)]',
  }
  return (
    <div className={cn('rounded-md border p-3', tones[tone])}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1 text-foreground">{value}</div>
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
