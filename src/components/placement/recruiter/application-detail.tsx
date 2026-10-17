'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  formatCurrency, formatDate, formatDateTime,
} from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, Briefcase, Building2, MapPin, Calendar, Video, ExternalLink,
  FileText, Clock, ArrowRight, DollarSign, History, User, Lock,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ApplicationEvent, ApplicationStatus, Interview, Offer } from '@/types'

interface AppJob { id: string; title: string; company: { id: string; name: string } }
interface AppResume { id: string; title: string; version: number }
interface AppStudent {
  id: string
  user: { id: string; name: string; email: string }
}

interface ApplicationDetail {
  id: string
  studentId: string
  student?: AppStudent
  jobId: string
  job?: AppJob
  resume?: AppResume | null
  status: ApplicationStatus
  appliedAt: string
  coverLetter?: string | null
  notes?: string | null
  events?: (ApplicationEvent & { actor?: { id: string; name: string } | null })[]
  interviews?: Interview[]
  offer?: Offer | null
}

interface ResumeBullet {
  id: string
  section: string
  text: string
  claimStatus: string
  orderIndex: number
}
interface ResumeDetail {
  id: string
  title: string
  version: number
  isGenerated: boolean
  summary?: string | null
  bullets?: ResumeBullet[]
}

const ALL_STATUSES: ApplicationStatus[] = [
  'APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN',
]
const INTERVIEW_TYPES = ['TECHNICAL', 'HR', 'MANAGERIAL', 'GROUP'] as const
const OFFER_DECISIONS = ['PENDING', 'ACCEPTED', 'DECLINED'] as const

const isTerminal = (s: ApplicationStatus) => s === 'REJECTED' || s === 'WITHDRAWN'

export function ApplicationDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()
  const [statusOpen, setStatusOpen] = useState(false)
  const [interviewOpen, setInterviewOpen] = useState(false)
  const [offerOpen, setOfferOpen] = useState(false)

  const { data, isLoading, isError, error, refetch } = useQuery<ApplicationDetail>({
    queryKey: ['application', id],
    queryFn: () => apiGet<ApplicationDetail>(`/api/applications/${id}`),
    staleTime: 30_000,
  })

  // Attempt to load resume preview; degrade gracefully if forbidden (owner-student only)
  const resumeQuery = useQuery<ResumeDetail, ApiError>({
    queryKey: ['resume', data?.resume?.id],
    queryFn: () => apiGet<ResumeDetail>(`/api/resumes/${data!.resume!.id}`),
    enabled: Boolean(data?.resume?.id),
    staleTime: 60_000,
    retry: false,
  })

  if (isLoading) return <ApplicationDetailSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load application'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data) {
    return <ErrorState message="Application not found" onRetry={() => refetch()} />
  }

  const job = data.job
  const student = data.student
  const events = data.events ?? []
  const interviews = (data.interviews ?? []).filter(i => !i.outcome)
  const offer = data.offer
  const timeline = [...events].reverse() // chronological

  return (
    <div className="space-y-6">
      <PageHeader
        title={job?.title ?? 'Application'}
        description={`${job?.company.name ?? ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('recruiter/applications')}>
          <ArrowLeft className="size-4 mr-1" /> All applications
        </Button>
      </PageHeader>

      {/* Status banner */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Current status</div>
                <div className="mt-1"><StatusBadge status={data.status} className="text-sm" /></div>
              </div>
              <div className="border-l pl-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Applied</div>
                <div className="text-sm font-medium mt-1">{formatDate(data.appliedAt)}</div>
              </div>
              {student && (
                <div className="border-l pl-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Candidate</div>
                  <button
                    className="text-sm font-medium text-foreground hover:underline mt-1 inline-flex items-center gap-1"
                    onClick={() => navigate('recruiter/candidates', { id: student.id, jobId: data.jobId })}
                  >
                    <User className="size-3" /> {student.user.name}
                  </button>
                  <div className="text-xs text-muted-foreground mt-0.5">{student.user.email}</div>
                </div>
              )}
              {job && (
                <div className="border-l pl-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Job</div>
                  <button
                    className="text-sm font-medium text-foreground hover:underline mt-1 inline-flex items-center gap-1"
                    onClick={() => navigate('recruiter/jobs', { id: job.id })}
                  >
                    <Briefcase className="size-3" /> {job.title}
                  </button>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Building2 className="size-3" /> {job.company.name}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {!isTerminal(data.status) && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setStatusOpen(true)}>
                    <ArrowRight className="size-4 mr-1" /> Update status
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)}>
                    <Calendar className="size-4 mr-1" /> Schedule interview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOfferOpen(true)}>
                    <DollarSign className="size-4 mr-1" /> Extend offer
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: cover letter + resume */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cover letter</CardTitle>
              <CardDescription>As submitted by the candidate</CardDescription>
            </CardHeader>
            <CardContent>
              {data.coverLetter ? (
                <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">
                  {data.coverLetter}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No cover letter was attached.</p>
              )}
              {data.notes && (
                <div className="mt-4 p-3 rounded-md bg-[var(--pending-muted)] border border-[var(--pending)]/30 text-sm text-[var(--pending-foreground)]">
                  <span className="font-medium">Internal notes:</span> {data.notes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resume preview */}
          {data.resume && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> Submitted resume
                </CardTitle>
                <CardDescription>
                  {data.resume.title} · Version {data.resume.version}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {resumeQuery.isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : resumeQuery.isError ? (
                  <div className="rounded-md border border-[var(--pending)]/30 bg-[var(--pending-muted)]/60 p-3 text-sm text-[var(--pending-foreground)] flex items-start gap-2">
                    <Lock className="size-4 mt-0.5 shrink-0" />
                    <div>
                      Resume bullet preview is restricted to the candidate and officers. Metadata only — PDF download is not permitted for recruiters.
                    </div>
                  </div>
                ) : resumeQuery.data ? (
                  <ResumePreview resume={resumeQuery.data} />
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Status timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="size-4" /> Status timeline
              </CardTitle>
              <CardDescription>{events.length} event{events.length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <ol className="relative border-l border-border ml-3 space-y-4">
                  {timeline.map((e, i) => (
                    <li key={e.id} className="pl-4 relative">
                      <span className={cn(
                        'absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-card',
                        i === timeline.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'
                      )} />
                      <div className="flex flex-wrap items-center gap-2">
                        {e.previousStatus && <StatusBadge status={e.previousStatus} size="sm" />}
                        {e.previousStatus && <ArrowRight className="size-3 text-muted-foreground" />}
                        <StatusBadge status={e.newStatus} size="sm" />
                        <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(e.timestamp)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        by {e.actor?.name ?? 'System'}
                        {e.reason ? ` — ${e.reason}` : ''}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: offer / interviews */}
        <div className="space-y-6">
          {offer && (
            <Card className="border-[var(--verified)]/30 bg-[var(--verified-muted)]/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-[var(--verified-foreground)]">
                  <DollarSign className="size-4" /> Offer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {offer.amount != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Compensation</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(offer.amount, offer.currency ?? 'INR')}
                    </span>
                  </div>
                )}
                {offer.currency && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium">{offer.currency}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Decision</span>
                  <StatusBadge status={offer.decision} />
                </div>
                {offer.expiresAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Expires</span>
                    <span className="font-medium">{formatDate(offer.expiresAt)}</span>
                  </div>
                )}
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setOfferOpen(true)}>
                  Update offer
                </Button>
              </CardContent>
            </Card>
          )}

          {interviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="size-4" /> Upcoming interviews
                </CardTitle>
                <CardDescription>{interviews.length} scheduled</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {interviews.map(iv => (
                    <li key={iv.id} className="p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className="text-xs">{iv.type}</Badge>
                        <Badge variant="secondary" className="text-xs">Round {iv.round}</Badge>
                      </div>
                      <div className="text-sm font-medium flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatDateTime(iv.scheduledAt)}
                      </div>
                      {iv.location && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="size-3" /> {iv.location}
                        </div>
                      )}
                      {iv.meetingUrl && (
                        <a
                          href={iv.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline inline-flex items-center gap-1"
                        >
                          <Video className="size-3" /> Join meeting
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                      {iv.notes && <p className="text-xs text-muted-foreground mt-1">{iv.notes}</p>}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* New interview CTA when none scheduled */}
          {interviews.length === 0 && !isTerminal(data.status) && (
            <Card className="border-dashed">
              <CardContent className="p-4 text-center">
                <Calendar className="size-6 mx-auto mb-2 text-muted-foreground/60" />
                <p className="text-sm font-medium">No interviews scheduled yet</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => setInterviewOpen(true)}>
                  <Calendar className="size-4 mr-1" /> Schedule first interview
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Update status dialog */}
      <UpdateStatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        applicationId={id}
        currentStatus={data.status}
      />

      {/* Schedule interview dialog */}
      <ScheduleInterviewDialog
        open={interviewOpen}
        onOpenChange={setInterviewOpen}
        applicationId={id}
        existingRound={data.interviews?.length ?? 0}
      />

      {/* Extend offer dialog */}
      <ExtendOfferDialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        applicationId={id}
        existingOffer={offer}
      />
    </div>
  )
}

function ResumePreview({ resume }: { resume: ResumeDetail }) {
  const bullets = resume.bullets ?? []
  if (bullets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">This resume has no bullets.</p>
    )
  }
  // Group bullets by section
  const sections = new Map<string, ResumeBullet[]>()
  for (const b of bullets) {
    const arr = sections.get(b.section) ?? []
    arr.push(b)
    sections.set(b.section, arr)
  }
  return (
    <div className="space-y-4">
      {resume.isGenerated && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px]">Auto-generated</Badge>
        </div>
      )}
      {resume.summary && (
        <p className="text-sm text-foreground bg-muted rounded-md p-3">
          {resume.summary}
        </p>
      )}
      {Array.from(sections.entries()).map(([section, items]) => (
        <div key={section}>
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{section}</h4>
          <ul className="space-y-1.5">
            {items.map(b => (
              <li key={b.id} className="text-sm flex items-start gap-2">
                <span className="text-muted-foreground/40 mt-1">•</span>
                <div className="flex-1">
                  <span className="text-foreground">{b.text}</span>
                  {b.claimStatus && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-2 text-[10px]',
                        b.claimStatus === 'SUPPORTED'
                          ? 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30'
                          : b.claimStatus === 'UNSUPPORTED'
                          ? 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30'
                          : 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30'
                      )}
                    >
                      {b.claimStatus}
                    </Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function UpdateStatusDialog({
  open, onOpenChange, applicationId, currentStatus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  currentStatus: ApplicationStatus
}) {
  const qc = useQueryClient()
  const [newStatus, setNewStatus] = useState<string>(currentStatus)
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: () => apiPatch(`/api/applications/${applicationId}`, {
      status: newStatus,
      reason: reason.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success(`Application status updated to ${newStatus}`)
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['recruiter-applications'] })
      qc.invalidateQueries({ queryKey: ['recruiter-dashboard'] })
      onOpenChange(false)
      setReason('')
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to update status')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Update application status</DialogTitle>
          <DialogDescription>
            Current: <StatusBadge status={currentStatus} />. The API enforces allowed transitions; invalid ones will be rejected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status-reason">Reason (optional)</Label>
            <Textarea
              id="status-reason"
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Passed technical screen, advancing to HR round"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || newStatus === currentStatus}>
            {mutation.isPending ? 'Updating…' : 'Update status'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleInterviewDialog({
  open, onOpenChange, applicationId, existingRound,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  existingRound: number
}) {
  const qc = useQueryClient()
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [type, setType] = useState<string>('TECHNICAL')
  const [round, setRound] = useState(String(existingRound + 1))
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        scheduledAt: new Date(scheduledAt).toISOString(),
        type,
        round: parseInt(round, 10) || existingRound + 1,
      }
      if (duration.trim()) body.duration = parseInt(duration, 10)
      if (location.trim()) body.location = location.trim()
      if (meetingUrl.trim()) body.meetingUrl = meetingUrl.trim()
      if (notes.trim()) body.notes = notes.trim()
      return apiPost(`/api/applications/${applicationId}/interview`, body)
    },
    onSuccess: () => {
      toast.success('Interview scheduled')
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['recruiter-applications'] })
      qc.invalidateQueries({ queryKey: ['recruiter-dashboard'] })
      onOpenChange(false)
      setScheduledAt('')
      setDuration('')
      setLocation('')
      setMeetingUrl('')
      setNotes('')
      setRound(String(existingRound + 1))
      setType('TECHNICAL')
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to schedule interview')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>
            The application will be auto-advanced to INTERVIEW stage if it isn't already.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="iv-scheduled">Scheduled at *</Label>
            <Input
              id="iv-scheduled"
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="iv-round">Round</Label>
              <Input
                id="iv-round"
                type="number"
                min={1}
                max={20}
                value={round}
                onChange={e => setRound(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interview type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVIEW_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="iv-duration">Duration (min)</Label>
              <Input
                id="iv-duration"
                type="number"
                min={5}
                max={480}
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="60"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iv-location">Location</Label>
              <Input
                id="iv-location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Conference Room A"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-meeting-url">Meeting URL</Label>
            <Input
              id="iv-meeting-url"
              type="url"
              value={meetingUrl}
              onChange={e => setMeetingUrl(e.target.value)}
              placeholder="https://meet.example/xyz"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iv-notes">Notes</Label>
            <Textarea
              id="iv-notes"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything the candidate should prepare…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !scheduledAt}>
            {mutation.isPending ? 'Scheduling…' : 'Schedule interview'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ExtendOfferDialog({
  open, onOpenChange, applicationId, existingOffer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  existingOffer?: Offer | null
}) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState(existingOffer?.amount != null ? String(existingOffer.amount) : '')
  const [currency, setCurrency] = useState(existingOffer?.currency ?? 'INR')
  const [decision, setDecision] = useState<string>(existingOffer?.decision ?? 'PENDING')
  const [expiresAt, setExpiresAt] = useState(existingOffer?.expiresAt ? isoToDate(existingOffer.expiresAt) : '')

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        currency,
        decision,
      }
      if (amount.trim()) body.amount = parseInt(amount, 10)
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString()
      return apiPost(`/api/applications/${applicationId}/offer`, body)
    },
    onSuccess: () => {
      toast.success('Offer saved')
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['recruiter-applications'] })
      qc.invalidateQueries({ queryKey: ['recruiter-dashboard'] })
      onOpenChange(false)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to save offer')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingOffer ? 'Update offer' : 'Extend offer'}</DialogTitle>
          <DialogDescription>
            The application will be auto-advanced to OFFER stage if it isn't terminal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="offer-amount">Amount</Label>
              <Input
                id="offer-amount"
                type="number"
                min={0}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="1200000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Decision</Label>
              <Select value={decision} onValueChange={setDecision}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OFFER_DECISIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-expires">Expires at</Label>
              <Input
                id="offer-expires"
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : (existingOffer ? 'Update offer' : 'Extend offer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function isoToDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading application…" description="Hang tight" />
      <Card><CardContent className="p-4 space-y-3"><Skeleton className="h-20 w-full" /></CardContent></Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
