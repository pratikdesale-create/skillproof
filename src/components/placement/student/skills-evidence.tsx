'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import {
  PageHeader, SectionHeader, CardSkeleton, EmptyState, ErrorState,
  StatCard, formatDate,
} from '@/components/placement/shared/ui'
import { SkillTag, EvidenceStatusBadge } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck, Plus, Trash2, ExternalLink, FileText, Award, Link2, Github,
  ClipboardList, Star, AlertCircle, ChevronDown, ChevronRight, History,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { EvidenceStatus } from '@/types'

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

interface EvidenceSkillRef {
  skillId: string
  name: string
  category?: string | null
  relevance: number
}

interface EvidenceRow {
  id: string
  type: string
  title: string
  description?: string | null
  sourceUrl?: string | null
  organization?: string | null
  assessor?: string | null
  score?: number | null
  maxScore?: number | null
  status: EvidenceStatus
  submittedAt: string
  reviewedAt?: string | null
  reviewerNotes?: string | null
  skills: EvidenceSkillRef[]
}

interface EvidenceReviewRecord {
  id: string
  reviewerId: string
  reviewerName: string
  action: string
  status: string
  reason?: string | null
  notes?: string | null
  createdAt: string
}

interface EvidenceDetailResponse {
  id: string
  type: string
  title: string
  description?: string | null
  sourceUrl?: string | null
  organization?: string | null
  status: EvidenceStatus
  submittedAt: string
  reviewedAt?: string | null
  reviewerNotes?: string | null
  skills: EvidenceSkillRef[]
  reviews: EvidenceReviewRecord[]
}

interface ListResponse<T> { data: T[] }

const EVIDENCE_TYPES = [
  { value: 'assessment', label: 'Assessment', icon: ClipboardList },
  { value: 'project', label: 'Project', icon: FileText },
  { value: 'github', label: 'GitHub repo', icon: Github },
  { value: 'certification', label: 'Certification', icon: Award },
  { value: 'demo_url', label: 'Demo URL', icon: Link2 },
  { value: 'report', label: 'Report', icon: FileText },
  { value: 'feedback', label: 'Feedback', icon: Star },
] as const

// Canonical skill categories (matching the Skill.category seed values)
const CATEGORY_GROUPS: { key: string; label: string }[] = [
  { key: 'language', label: 'Programming Languages' },
  { key: 'framework', label: 'Frameworks' },
  { key: 'database', label: 'Databases' },
  { key: 'tool', label: 'Tools' },
  { key: 'cloud', label: 'Cloud & DevOps' },
  { key: 'domain', label: 'Domain Knowledge' },
  { key: 'communication', label: 'Communication & Other' },
]

function bucketCategory(cat?: string | null): string {
  const c = (cat ?? '').toLowerCase()
  if (c.includes('language') || c === 'language') return 'language'
  if (c.includes('framework')) return 'framework'
  if (c.includes('database') || c.includes('db')) return 'database'
  if (c.includes('tool')) return 'tool'
  if (c.includes('cloud') || c.includes('devops') || c.includes('infra')) return 'cloud'
  if (c.includes('domain') || c.includes('soft') || c.includes('communication')) return 'communication'
  return 'communication' // default bucket
}

export function SkillsEvidence() {
  const qc = useQueryClient()

  const skillsQuery = useQuery<ListResponse<StudentSkillRow>>({
    queryKey: ['student-skills'],
    queryFn: () => apiGet<ListResponse<StudentSkillRow>>('/api/student/skills'),
    staleTime: 30_000,
  })
  const evidenceQuery = useQuery<ListResponse<EvidenceRow>>({
    queryKey: ['student-evidence'],
    queryFn: () => apiGet<ListResponse<EvidenceRow>>('/api/student/evidence'),
    staleTime: 30_000,
  })

  // --- Add skill ---
  const [skillInput, setSkillInput] = useState('')
  const [selfRated, setSelfRated] = useState<'beginner' | 'intermediate' | 'advanced' | ''>('')

  const addSkillMutation = useMutation({
    mutationFn: async (raw: string) => {
      const norm = await apiPost<{ results: Array<{ rawName: string; canonical: { skillId: string; displayName: string } | null }> }>('/api/skills/normalize', { names: [raw] })
      const matched = norm.results.find((r): r is { rawName: string; canonical: { skillId: string; displayName: string } } => r.canonical != null)
      if (!matched) {
        throw new Error(`Could not resolve "${raw}" to a known skill`)
      }
      return apiPost<StudentSkillRow>('/api/student/skills', {
        skillName: matched.canonical.displayName,
        selfRated: selfRated || undefined,
      })
    },
    onSuccess: () => {
      toast.success('Skill added')
      setSkillInput('')
      setSelfRated('')
      qc.invalidateQueries({ queryKey: ['student-skills'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to add skill')
    },
  })

  const deleteSkillMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/student/skills/${id}`),
    onSuccess: () => {
      toast.success('Skill removed')
      qc.invalidateQueries({ queryKey: ['student-skills'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to remove skill')
    },
  })

  // --- Submit evidence ---
  const [evidenceDialogOpen, setEvidenceDialogOpen] = useState(false)

  const submitEvidenceMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => apiPost('/api/student/evidence', body),
    onSuccess: () => {
      toast.success('Evidence submitted — pending review')
      setEvidenceDialogOpen(false)
      qc.invalidateQueries({ queryKey: ['student-evidence'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to submit evidence')
    },
  })

  // Compute supporting evidence per skill (lookup: evidence -> skills)
  const evidenceForSkill = useMemo(() => {
    const map = new Map<string, EvidenceRow[]>()
    for (const ev of evidenceQuery.data?.data ?? []) {
      for (const s of ev.skills) {
        const arr = map.get(s.skillId) ?? []
        arr.push(ev)
        map.set(s.skillId, arr)
      }
    }
    return map
  }, [evidenceQuery.data])

  // Group skills by canonical category bucket
  const groupedSkills = useMemo(() => {
    const skills = skillsQuery.data?.data ?? []
    const buckets: Record<string, StudentSkillRow[]> = {}
    for (const cat of CATEGORY_GROUPS) buckets[cat.key] = []
    for (const s of skills) {
      const bucket = bucketCategory(s.category)
      ;(buckets[bucket] ?? (buckets[bucket] = [])).push(s)
    }
    return CATEGORY_GROUPS.map(g => ({ ...g, skills: buckets[g.key] ?? [] })).filter(g => g.skills.length > 0)
  }, [skillsQuery.data])

  const skills = skillsQuery.data?.data ?? []
  const evidence = evidenceQuery.data?.data ?? []
  const verifiedCount = skills.filter(s => s.isVerified).length
  const pendingEvidence = evidence.filter(e => e.status === 'PENDING_REVIEW' || e.status === 'NEEDS_MORE_EVIDENCE').length
  const unverifiedClaims = skills.length - verifiedCount

  const loading = skillsQuery.isLoading || evidenceQuery.isLoading
  const error = (skillsQuery.error as Error) ?? (evidenceQuery.error as Error)

  if (loading) return <SkillsSkeleton />
  if (error) {
    return (
      <ErrorState
        message={error.message ?? 'Failed to load skills & evidence'}
        onRetry={() => { skillsQuery.refetch(); evidenceQuery.refetch() }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Skills & Evidence"
        description="Claim skills, back them with verifiable evidence, and track verification status"
      >
        <Dialog open={evidenceDialogOpen} onOpenChange={setEvidenceDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" /> Submit evidence
            </Button>
          </DialogTrigger>
          <EvidenceSubmitDialog
            onSubmit={(body) => submitEvidenceMutation.mutate(body)}
            pending={submitEvidenceMutation.isPending}
          />
        </Dialog>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total skills" value={skills.length} hint="Claimed in your inventory" icon={ShieldCheck} tone="info" />
        <StatCard label="Verified" value={verifiedCount} hint="Backed by approved evidence" icon={Award} tone="success" />
        <StatCard label="Pending evidence" value={pendingEvidence} hint="Awaiting officer review" icon={ClipboardList} tone={pendingEvidence > 0 ? 'warning' : 'default'} />
        <StatCard label="Unverified claims" value={unverifiedClaims} hint="Need supporting evidence" icon={AlertCircle} tone={unverifiedClaims > 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: skills grouped by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> Skills by category
            </CardTitle>
            <CardDescription>
              {verifiedCount} of {skills.length} verified by evidence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add skill form */}
            <div className="rounded-md border p-3 bg-muted/40 space-y-3">
              <Label htmlFor="newSkill" className="text-xs uppercase tracking-wider text-muted-foreground">Add skill</Label>
              <Input
                id="newSkill"
                placeholder="e.g. React, Python, PostgreSQL"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && skillInput.trim()) {
                    e.preventDefault()
                    addSkillMutation.mutate(skillInput.trim())
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Select value={selfRated} onValueChange={(v) => setSelfRated(v as typeof selfRated)}>
                  <SelectTrigger className="w-40" size="sm">
                    <SelectValue placeholder="Self-rated level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={() => skillInput.trim() && addSkillMutation.mutate(skillInput.trim())}
                  disabled={!skillInput.trim() || addSkillMutation.isPending}
                >
                  {addSkillMutation.isPending ? 'Adding…' : 'Add'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Skills normalize to a canonical entry. Verified evidence upgrades your claim automatically.
              </p>
            </div>

            {/* Skill list grouped by category */}
            {skills.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No skills yet"
                description="Add the skills you can demonstrate — they drive your fit scores"
              />
            ) : (
              <div className="space-y-2">
                {groupedSkills.map((group) => (
                  <SkillCategoryGroup
                    key={group.key}
                    label={group.label}
                    skills={group.skills}
                    evidenceForSkill={evidenceForSkill}
                    onDelete={(id) => deleteSkillMutation.mutate(id)}
                    deleting={deleteSkillMutation.isPending}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: evidence list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Evidence
            </CardTitle>
            <CardDescription>
              {evidence.length} submission{evidence.length === 1 ? '' : 's'} · {pendingEvidence} pending review
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {evidence.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No evidence submitted"
                description="Submit assessments, projects, certifications, or feedback to verify your skills"
                action={
                  <Button size="sm" onClick={() => setEvidenceDialogOpen(true)}>
                    <Plus className="size-4 mr-2" /> Submit evidence
                  </Button>
                }
              />
            ) : (
              <ScrollArea className="max-h-[32rem] scroll-area-thin">
                <ul className="divide-y">
                  {evidence.map((ev) => (
                    <EvidenceItem key={ev.id} ev={ev} />
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-4">
        <AlertCircle className="size-3.5" />
        Evidence needs officer approval to count as verified. Submit concrete artifacts (GitHub URLs, certs, project links).
      </div>
    </div>
  )
}

function SkillCategoryGroup({
  label, skills, evidenceForSkill, onDelete, deleting,
}: {
  label: string
  skills: StudentSkillRow[]
  evidenceForSkill: Map<string, EvidenceRow[]>
  onDelete: (id: string) => void
  deleting: boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between gap-2 p-3 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex items-center gap-2 min-w-0">
              {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
              <span className="text-sm font-semibold">{label}</span>
            </div>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {skills.length}
            </Badge>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y border-t">
            {skills.map((s) => {
              const evidenceList = evidenceForSkill.get(s.skillId) ?? []
              const mostRelevant = evidenceList.find(e => e.status === 'VERIFIED') ?? evidenceList[0]
              return (
                <li key={s.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <SkillTag name={s.name} isVerified={s.isVerified} />
                        {s.selfRated && (
                          <Badge variant="secondary" className="text-xs capitalize">{s.selfRated}</Badge>
                        )}
                        {s.source && (
                          <Badge variant="outline" className="text-xs">via {s.source}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{evidenceList.length} supporting evidence</span>
                        <span>·</span>
                        <span>Added {formatDate(s.addedAt)}</span>
                      </div>
                      {mostRelevant && (
                        <div className="text-xs text-muted-foreground">
                          Most relevant: <span className="text-foreground">{mostRelevant.title}</span>{' '}
                          <EvidenceStatusBadge status={mostRelevant.status} size="sm" />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-[var(--danger-foreground)] hover:bg-[var(--danger-muted)] hover:text-[var(--danger-foreground)] shrink-0"
                      onClick={() => onDelete(s.id)}
                      disabled={deleting}
                      aria-label={`Remove ${s.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function EvidenceItem({ ev }: { ev: EvidenceRow }) {
  const [expanded, setExpanded] = useState(false)
  const typeMeta = EVIDENCE_TYPES.find(t => t.value === ev.type)
  const TypeIcon = typeMeta?.icon ?? FileText
  return (
    <li className="p-3">
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <TypeIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="font-medium text-sm truncate">{ev.title}</div>
            <EvidenceStatusBadge status={ev.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{ev.type}</Badge>
            {ev.organization && <span>{ev.organization}</span>}
            {ev.assessor && <span>· Assessed by {ev.assessor}</span>}
            {(ev.score != null || ev.maxScore != null) && (
              <span>· Score: {ev.score ?? '—'}/{ev.maxScore ?? '—'}</span>
            )}
          </div>
          {ev.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ev.description}</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {ev.skills.map(es => (
              <SkillTag key={es.skillId} name={es.name} size="sm" />
            ))}
          </div>
          {ev.sourceUrl && (
            <a
              href={ev.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1 mt-2"
            >
              <ExternalLink className="size-3" /> {ev.sourceUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
          {ev.reviewerNotes && (
            <div className="text-xs text-[var(--pending-foreground)] bg-[var(--pending-muted)] border border-[var(--pending)]/30 rounded p-2 mt-2">
              <span className="font-medium">Reviewer:</span> {ev.reviewerNotes}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            Submitted {formatDate(ev.submittedAt)}
            {ev.reviewedAt ? ` · Reviewed ${formatDate(ev.reviewedAt)}` : ''}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 text-xs"
            onClick={() => setExpanded(v => !v)}
          >
            <History className="size-3 mr-1" />
            {expanded ? 'Hide review history' : 'View details'}
          </Button>
          {expanded && (
            <ReviewHistory evidenceId={ev.id} />
          )}
        </div>
      </div>
    </li>
  )
}

function ReviewHistory({ evidenceId }: { evidenceId: string }) {
  const { data, isLoading, isError } = useQuery<EvidenceDetailResponse>({
    queryKey: ['evidence-detail', evidenceId],
    queryFn: () => apiGet<EvidenceDetailResponse>(`/api/evidence/${evidenceId}`),
    staleTime: 30_000,
  })
  if (isLoading) return <div className="text-xs text-muted-foreground mt-2">Loading review history…</div>
  if (isError) return <div className="text-xs text-[var(--danger-foreground)] mt-2">Could not load review history.</div>
  const reviews = data?.reviews ?? []
  if (reviews.length === 0) {
    return (
      <div className="text-xs text-muted-foreground mt-2 p-2 rounded border bg-muted/40">
        No reviews recorded yet. This evidence is still awaiting officer action.
      </div>
    )
  }
  return (
    <ol className="mt-2 space-y-2 border-l ml-1 pl-3">
      {reviews.map((r) => (
        <li key={r.id} className="text-xs space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <EvidenceStatusBadge status={r.status as EvidenceStatus} size="sm" />
            <Badge variant="outline" className="text-xs">{r.action}</Badge>
            <span className="text-muted-foreground ml-auto">{formatDate(r.createdAt)}</span>
          </div>
          <div className="text-muted-foreground">by {r.reviewerName}</div>
          {r.reason && <div className="text-foreground">Reason: {r.reason}</div>}
          {r.notes && <div className="text-muted-foreground">{r.notes}</div>}
        </li>
      ))}
    </ol>
  )
}

function EvidenceSubmitDialog({
  onSubmit,
  pending,
}: {
  onSubmit: (body: Record<string, unknown>) => void
  pending: boolean
}) {
  const [type, setType] = useState<string>('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [organization, setOrganization] = useState('')
  const [assessor, setAssessor] = useState('')
  const [score, setScore] = useState('')
  const [maxScore, setMaxScore] = useState('')
  const [skillNamesRaw, setSkillNamesRaw] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!type || !title.trim() || !skillNamesRaw.trim()) {
      toast.error('Type, title, and at least one skill are required')
      return
    }
    const skillNames = skillNamesRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    if (skillNames.length === 0) {
      toast.error('Add at least one skill name')
      return
    }
    const body: Record<string, unknown> = {
      type,
      title: title.trim(),
      skillNames,
    }
    if (description.trim()) body.description = description.trim()
    if (sourceUrl.trim()) body.sourceUrl = sourceUrl.trim()
    if (organization.trim()) body.organization = organization.trim()
    if (assessor.trim()) body.assessor = assessor.trim()
    if (score !== '') body.score = Number(score)
    if (maxScore !== '') body.maxScore = Number(maxScore)
    onSubmit(body)
  }

  return (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Submit evidence</DialogTitle>
        <DialogDescription>
          Back your skills with verifiable artifacts. Officers will review within 1–2 business days.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ev-type">Type *</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="ev-type" className="w-full">
              <SelectValue placeholder="Choose evidence type" />
            </SelectTrigger>
            <SelectContent>
              {EVIDENCE_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-title">Title *</Label>
          <Input
            id="ev-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full-stack capstone: Chat app"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-desc">Description</Label>
          <Textarea
            id="ev-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this evidence demonstrate?"
            maxLength={5000}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ev-url">Source URL</Label>
            <Input
              id="ev-url"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ev-org">Organization</Label>
            <Input
              id="ev-org"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g. HackerRank"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="ev-assessor">Assessor</Label>
            <Input
              id="ev-assessor"
              value={assessor}
              onChange={(e) => setAssessor(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="ev-score">Score</Label>
              <Input
                id="ev-score"
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-max">Max</Label>
              <Input
                id="ev-max"
                type="number"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="100"
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ev-skills">Skill names *</Label>
          <Input
            id="ev-skills"
            value={skillNamesRaw}
            onChange={(e) => setSkillNamesRaw(e.target.value)}
            placeholder="React, TypeScript, PostgreSQL (comma-separated)"
          />
          <p className="text-xs text-muted-foreground">
            Skills auto-normalize to canonical entries. Unknown names are skipped.
          </p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? 'Submitting…' : 'Submit for review'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function SkillsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="My Skills & Evidence" description="Loading…" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-16" />)}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-4 w-32" />
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-20" />)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
