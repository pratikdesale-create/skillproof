'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '@/lib/api-client'
import { PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate } from '@/components/placement/shared/ui'
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  ShieldCheck, Plus, Trash2, ExternalLink, FileText, Award, Link2, Github,
  ClipboardList, Video, Star, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
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
      // First normalize the skill name
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

  // --- Delete skill ---
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
    mutationFn: async (body: Record<string, unknown>) =>
      apiPost('/api/student/evidence', body),
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
        title="Skills & Evidence"
        description="Claim skills, back them with verifiable evidence"
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
        <SummaryStat label="Total skills" value={skills.length} tone="default" />
        <SummaryStat label="Verified" value={verifiedCount} tone="success" />
        <SummaryStat label="Pending evidence" value={pendingEvidence} tone="warning" />
        <SummaryStat label="Unverified claims" value={unverifiedClaims} tone={unverifiedClaims > 0 ? 'danger' : 'success'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> My skills
            </CardTitle>
            <CardDescription>{verifiedCount} of {skills.length} verified by evidence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add skill form */}
            <div className="border rounded-md p-3 bg-slate-50 dark:bg-slate-900 space-y-3">
              <Label htmlFor="newSkill" className="text-xs uppercase tracking-wider text-slate-500">Add skill</Label>
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
              <p className="text-xs text-slate-500">
                Skills must normalize to a canonical entry. Verified evidence upgrades your claim automatically.
              </p>
            </div>

            {/* Skill list */}
            {skills.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No skills yet"
                description="Add the skills you can demonstrate — they drive your fit scores"
              />
            ) : (
              <ScrollArea className="max-h-96">
                <ul className="space-y-2">
                  {skills.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SkillTag name={s.name} isVerified={s.isVerified} />
                          {s.category && (
                            <Badge variant="outline" className="text-xs text-slate-500">
                              {s.category}
                            </Badge>
                          )}
                          {s.selfRated && (
                            <Badge variant="secondary" className="text-xs">
                              {s.selfRated}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Added {formatDate(s.addedAt)}
                          {s.source ? ` · via ${s.source}` : ''}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                        onClick={() => deleteSkillMutation.mutate(s.id)}
                        disabled={deleteSkillMutation.isPending}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Right: evidence */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="size-4" /> Evidence
            </CardTitle>
            <CardDescription>{evidence.length} submissions · {pendingEvidence} pending review</CardDescription>
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
              <ScrollArea className="max-h-[28rem]">
                <ul className="divide-y">
                  {evidence.map((ev) => {
                    const typeMeta = EVIDENCE_TYPES.find(t => t.value === ev.type)
                    const TypeIcon = typeMeta?.icon ?? FileText
                    return (
                      <li key={ev.id} className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="size-8 rounded-md bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0">
                            <TypeIcon className="size-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="font-medium text-sm truncate">{ev.title}</div>
                              <EvidenceStatusBadge status={ev.status} />
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">{ev.type}</Badge>
                              {ev.organization && <span>{ev.organization}</span>}
                              {ev.assessor && <span>· Assessed by {ev.assessor}</span>}
                              {(ev.score != null || ev.maxScore != null) && (
                                <span>· Score: {ev.score ?? '—'}/{ev.maxScore ?? '—'}</span>
                              )}
                            </div>
                            {ev.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                                {ev.description}
                              </p>
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
                                className="text-xs text-slate-600 dark:text-slate-400 hover:text-foreground underline inline-flex items-center gap-1 mt-2"
                              >
                                <ExternalLink className="size-3" /> {ev.sourceUrl.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                            {ev.reviewerNotes && (
                              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded p-2 mt-2">
                                <span className="font-medium">Reviewer:</span> {ev.reviewerNotes}
                              </div>
                            )}
                            <div className="text-xs text-slate-400 mt-1">
                              Submitted {formatDate(ev.submittedAt)}
                              {ev.reviewedAt ? ` · Reviewed ${formatDate(ev.reviewedAt)}` : ''}
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-500 border-t pt-4">
        <AlertCircle className="size-3.5" />
        Evidence needs officer approval to count as verified. Submit concrete artifacts (GitHub URLs, certs, project links).
      </div>
    </div>
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
          <p className="text-xs text-slate-500">
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

function SummaryStat({
  label, value, tone,
}: {
  label: string
  value: number
  tone: 'default' | 'success' | 'warning' | 'danger'
}) {
  const tones: Record<string, string> = {
    default: 'border-slate-200 dark:border-slate-800',
    success: 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-900',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-900',
    danger: 'border-rose-200 bg-rose-50 dark:bg-rose-950/40 dark:border-rose-900',
  }
  return (
    <Card className={tones[tone]}>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      </CardContent>
    </Card>
  )
}

function SkillsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Skills & Evidence" description="Claim skills, back them with verifiable evidence" />
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
