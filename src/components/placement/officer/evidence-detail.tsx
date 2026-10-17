'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  formatDate, formatDateTime,
} from '@/components/placement/shared/ui'
import { EvidenceStatusBadge } from '@/components/placement/shared/skill-tag'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft, ShieldCheck, ExternalLink, User,
  CheckCircle2, XCircle, AlertTriangle, History, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface EvidenceDetail {
  id: string
  type: string
  title: string
  description?: string | null
  sourceUrl?: string | null
  organization?: string | null
  assessor?: string | null
  score?: number | null
  maxScore?: number | null
  status: string
  submittedAt: string
  reviewerId?: string | null
  reviewerNotes?: string | null
  reviewedAt?: string | null
  provenance?: string | null
  student: {
    id: string
    name: string
    email: string
    batch?: string | null
    branch?: string | null
    cgpa?: number | null
  }
  skills: Array<{ skillId: string; name: string; category?: string | null; relevance: number }>
  reviews: Array<{
    id: string
    reviewerId: string
    reviewerName: string
    action: string
    status: string
    reason?: string | null
    notes?: string | null
    createdAt: string
  }>
}

type ReviewAction = 'APPROVE' | 'REJECT' | 'REQUEST_MORE'

const ACTION_META: Record<ReviewAction, {
  title: string
  description: string
  needsReason: boolean
  cta: string
  icon: React.ComponentType<{ className?: string }>
  buttonCls: string
  dialogBtnCls: string
}> = {
  APPROVE: {
    title: 'Approve evidence',
    description: 'Mark this evidence as verified. Related student skills will be marked verified.',
    needsReason: false,
    cta: 'Approve evidence',
    icon: CheckCircle2,
    buttonCls: 'bg-[var(--verified)] hover:bg-[var(--verified)]/90 text-[var(--verified-foreground)] border-transparent',
    dialogBtnCls: 'bg-[var(--verified)] hover:bg-[var(--verified)]/90 text-[var(--verified-foreground)]',
  },
  REJECT: {
    title: 'Reject evidence',
    description: 'Reject this evidence. The student will be notified with your reason.',
    needsReason: true,
    cta: 'Reject evidence',
    icon: XCircle,
    buttonCls: 'bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-[var(--danger-foreground)] border-transparent',
    dialogBtnCls: 'bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-[var(--danger-foreground)]',
  },
  REQUEST_MORE: {
    title: 'Request more evidence',
    description: 'Ask the student to provide additional supporting evidence.',
    needsReason: true,
    cta: 'Request more',
    icon: AlertTriangle,
    buttonCls: 'bg-[var(--pending)] hover:bg-[var(--pending)]/90 text-[var(--pending-foreground)] border-transparent',
    dialogBtnCls: 'bg-[var(--pending)] hover:bg-[var(--pending)]/90 text-[var(--pending-foreground)]',
  },
}

const ACTION_BADGE_CLS: Record<string, string> = {
  APPROVE: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  REJECT: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  REQUEST_MORE: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
}

export function EvidenceDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery<EvidenceDetail>({
    queryKey: ['evidence', id],
    queryFn: () => apiGet<EvidenceDetail>(`/api/evidence/${id}`),
    staleTime: 30_000,
  })

  const [dialogAction, setDialogAction] = useState<ReviewAction | null>(null)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const reviewMutation = useMutation({
    mutationFn: (vars: { action: ReviewAction; reason?: string; notes?: string }) =>
      apiPost<{
        reviewId: string
        evidenceId: string
        action: ReviewAction
        newStatus: string
        reviewerId: string
        reviewedAt: string
      }>(`/api/evidence/${id}/review`, vars),
    onSuccess: (resp) => {
      const msg = resp.action === 'APPROVE'
        ? 'Evidence approved — student skills verified'
        : resp.action === 'REJECT'
        ? 'Evidence rejected'
        : 'Requested more evidence'
      toast.success(msg)
      setDialogAction(null)
      setReason('')
      setNotes('')
      qc.invalidateQueries({ queryKey: ['evidence', id] })
      qc.invalidateQueries({ queryKey: ['evidence-pending'] })
      qc.invalidateQueries({ queryKey: ['officer-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to submit review')
    },
  })

  function submit() {
    if (!dialogAction) return
    if (ACTION_META[dialogAction].needsReason && !reason.trim()) {
      toast.error('Please provide a reason')
      return
    }
    reviewMutation.mutate({
      action: dialogAction,
      reason: reason.trim() || undefined,
      notes: notes.trim() || undefined,
    })
  }

  function openDialog(action: ReviewAction) {
    setDialogAction(action)
    setReason('')
    setNotes('')
  }

  function closeDialog() {
    setDialogAction(null)
    setReason('')
    setNotes('')
  }

  if (isLoading) return <EvidenceDetailSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load evidence'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data) return <ErrorState message="Evidence not found" onRetry={() => refetch()} />

  const reviews = [...data.reviews].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`${data.student.name}${data.student.batch ? ` · Batch ${data.student.batch}` : ''}${data.student.branch ? ` · ${data.student.branch}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('officer/evidence')}>
          <ArrowLeft className="size-4 mr-1" /> Back to queue
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('officer/students', { id: data.student.id })}
        >
          <User className="size-4 mr-1" /> View student
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: metadata */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4" /> Evidence details
            </CardTitle>
            <CardDescription>
              Submitted {formatDateTime(data.submittedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Meta label="Type" value={data.type.replace(/_/g, ' ')} className="capitalize" />
              <Meta label="Status" value={<EvidenceStatusBadge status={data.status as never} />} />
              <Meta label="Submitted" value={formatDate(data.submittedAt)} />
              {data.organization && <Meta label="Organization" value={data.organization} />}
              {data.assessor && <Meta label="Assessor" value={data.assessor} />}
              {data.score != null && (
                <Meta
                  label="Score"
                  value={`${data.score}${data.maxScore != null ? `/${data.maxScore}` : ''}`}
                />
              )}
              {data.reviewedAt && (
                <Meta label="Reviewed" value={formatDate(data.reviewedAt)} />
              )}
              {data.provenance && <Meta label="Provenance" value={data.provenance} />}
            </div>

            {data.description && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Description</div>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {data.description}
                </p>
              </div>
            )}

            {data.sourceUrl && (
              <a
                href={data.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-[var(--info-foreground)] hover:underline"
              >
                <ExternalLink className="size-3.5" /> View source
              </a>
            )}

            {data.reviewerNotes && (
              <div className="rounded-md border border-[var(--pending)]/30 bg-[var(--pending-muted)] p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-[var(--pending-foreground)] mb-1">
                  Previous reviewer notes
                </div>
                <p className="text-[var(--pending-foreground)]">{data.reviewerNotes}</p>
              </div>
            )}

            {/* Supported skills */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Skills supported ({data.skills.length})
              </div>
              {data.skills.length === 0 ? (
                <p className="text-sm text-muted-foreground">No skills attached to this evidence.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.skills.map((s) => (
                    <SkillTag key={s.skillId} name={s.name} />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right: actions + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review action</CardTitle>
              <CardDescription>Choose how to resolve this evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(Object.keys(ACTION_META) as ReviewAction[]).map((action) => {
                const meta = ACTION_META[action]
                const Icon = meta.icon
                return (
                  <Button
                    key={action}
                    className={cn('w-full justify-start', meta.buttonCls)}
                    onClick={() => openDialog(action)}
                    disabled={reviewMutation.isPending}
                  >
                    <Icon className="size-4 mr-2" />
                    {meta.cta}
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4" /> Review history
              </CardTitle>
              <CardDescription>{reviews.length} review{reviews.length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {reviews.length === 0 ? (
                <EmptyState icon={History} title="No reviews yet" description="Be the first to review this evidence" />
              ) : (
                <ol className="relative border-l border-border ml-4 space-y-4 p-3">
                  {reviews.map((r) => (
                    <li key={r.id} className="pl-4 relative">
                      <span className="absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-card bg-muted-foreground/40" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('text-xs', ACTION_BADGE_CLS[r.action] ?? '')}>
                          {r.action.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{r.status.replace(/_/g, ' ')}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(r.createdAt)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">By {r.reviewerName}</div>
                      {r.reason && <div className="text-sm text-foreground mt-1">{r.reason}</div>}
                      {r.notes && (
                        <div className="text-xs text-muted-foreground mt-1 italic">Notes: {r.notes}</div>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Review action dialog */}
      <Dialog
        open={dialogAction !== null}
        onOpenChange={(open) => { if (!open) closeDialog() }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogAction ? ACTION_META[dialogAction].title : ''}</DialogTitle>
            <DialogDescription>{dialogAction ? ACTION_META[dialogAction].description : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="reason" className="text-xs text-muted-foreground">
                Reason {dialogAction && ACTION_META[dialogAction].needsReason ? '(required)' : '(optional)'}
              </Label>
              <Textarea
                id="reason"
                placeholder="Explain the decision to the student…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="notes" className="text-xs text-muted-foreground">Internal notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Private notes for officers only…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              className={dialogAction ? ACTION_META[dialogAction].dialogBtnCls : ''}
              onClick={submit}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending ? (
                <><Loader2 className="size-4 mr-1 animate-spin" /> Submitting…</>
              ) : (
                dialogAction ? ACTION_META[dialogAction].cta : 'Submit'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Meta({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-medium mt-0.5 ${className ?? ''}`}>{value}</div>
    </div>
  )
}

function EvidenceDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading evidence…" description="Hang tight" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-40 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
