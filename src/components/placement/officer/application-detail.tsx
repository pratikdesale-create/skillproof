'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ArrowLeft, User, Briefcase, Calendar, Clock, MapPin, Video,
  ExternalLink, FileText, DollarSign, History, ArrowRight, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ApplicationEvent, ApplicationStatus, Interview, Offer } from '@/types'

interface AppStudent { id: string; user: { id: string; name: string; email: string } }
interface AppJob { id: string; title: string; company: { id: string; name: string } }
interface AppResume { id: string; title: string; version: number }

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

const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: ['UNDER_REVIEW', 'SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['SHORTLISTED', 'ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  SHORTLISTED: ['ASSESSMENT', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  ASSESSMENT: ['INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN'],
  INTERVIEW: ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER: ['WITHDRAWN', 'REJECTED'],
  REJECTED: [],
  WITHDRAWN: [],
}

const INTERVIEW_TYPES = ['TECHNICAL', 'HR', 'MANAGERIAL', 'GROUP']
const OFFER_DECISIONS = ['PENDING', 'ACCEPTED', 'DECLINED']

export function ApplicationDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery<ApplicationDetail>({
    queryKey: ['application', id],
    queryFn: () => apiGet<ApplicationDetail>(`/api/applications/${id}`),
    staleTime: 30_000,
  })

  const [statusDialog, setStatusDialog] = useState(false)
  const [interviewDialog, setInterviewDialog] = useState(false)
  const [offerDialog, setOfferDialog] = useState(false)

  if (isLoading) return <ApplicationDetailSkeleton />
  if (isError) {
    return <ErrorState message={(error as Error)?.message ?? 'Failed to load application'} onRetry={() => refetch()} />
  }
  if (!data) return <ErrorState message="Application not found" onRetry={() => refetch()} />

  const job = data.job
  const student = data.student
  const events = data.events ?? []
  const interviews = (data.interviews ?? []).filter((i) => !i.outcome)
  const offer = data.offer
  const timeline = [...events].reverse()

  const allowedNext = ALLOWED_TRANSITIONS[data.status] ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={job?.title ?? 'Application'}
        description={`${job?.company.name ?? ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('officer/applications')}>
          <ArrowLeft className="size-4 mr-1" /> Back
        </Button>
        {student && (
          <Button variant="outline" size="sm" onClick={() => navigate('officer/students', { id: student.id })}>
            <User className="size-4 mr-1" /> Student
          </Button>
        )}
        {job && (
          <Button variant="outline" size="sm" onClick={() => navigate('officer/jobs', { id: job.id })}>
            <Briefcase className="size-4 mr-1" /> Job
          </Button>
        )}
        {allowedNext.length > 0 && (
          <Button size="sm" onClick={() => setStatusDialog(true)}>
            Update status
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setInterviewDialog(true)}>
          <Calendar className="size-4 mr-1" /> Schedule interview
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOfferDialog(true)}>
          <DollarSign className="size-4 mr-1" /> Extend offer
        </Button>
      </PageHeader>

      {/* Status banner */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Student</div>
            <div className="text-sm font-medium mt-1">{student?.user.name ?? '—'}</div>
            <div className="text-xs text-muted-foreground">{student?.user.email ?? ''}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
            <div className="mt-1"><StatusBadge status={data.status} /></div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Applied</div>
            <div className="text-sm font-medium mt-1">{formatDate(data.appliedAt)}</div>
            {data.resume && (
              <button
                className="text-xs text-[var(--info-foreground)] hover:underline mt-1 inline-flex items-center gap-1"
                onClick={() => student && navigate('officer/students', { id: student.id })}
              >
                <FileText className="size-3" /> Resume: {data.resume.title}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: cover letter + timeline */}
        <div className="space-y-6 lg:col-span-2">
          {data.coverLetter && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cover letter</CardTitle>
                <CardDescription>As submitted by student</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {data.coverLetter}
                </p>
                {data.notes && (
                  <div className="mt-4 p-3 rounded-md bg-[var(--pending-muted)] border border-[var(--pending)]/30 text-sm text-[var(--pending-foreground)]">
                    <span className="font-medium">Internal notes:</span> {data.notes}
                  </div>
                )}
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

        {/* Right: interviews + offer */}
        <div className="space-y-6">
          {offer && (
            <Card className="border-[var(--verified)]/30 bg-[var(--verified-muted)]/60">
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
                  {interviews.map((iv) => (
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
                        <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--info-foreground)] hover:underline inline-flex items-center gap-1">
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

          {data.resume && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="size-4" /> Submitted resume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{data.resume.title}</div>
                    <div className="text-xs text-muted-foreground">Version {data.resume.version}</div>
                  </div>
                  <a
                    href={`/api/resumes/${data.resume.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--info-foreground)] hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="size-3" /> View PDF
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Read-only summary. Full resume builder is on the student side.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Update status dialog */}
      <UpdateStatusDialog
        open={statusDialog}
        onOpenChange={setStatusDialog}
        applicationId={id}
        currentStatus={data.status}
        allowedNext={allowedNext}
      />

      {/* Schedule interview dialog */}
      <ScheduleInterviewDialog
        open={interviewDialog}
        onOpenChange={setInterviewDialog}
        applicationId={id}
      />

      {/* Extend offer dialog */}
      <ExtendOfferDialog
        open={offerDialog}
        onOpenChange={setOfferDialog}
        applicationId={id}
        existingOffer={offer}
      />
    </div>
  )
}

function UpdateStatusDialog({
  open, onOpenChange, applicationId, currentStatus, allowedNext,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  currentStatus: ApplicationStatus
  allowedNext: ApplicationStatus[]
}) {
  const qc = useQueryClient()
  const [newStatus, setNewStatus] = useState<ApplicationStatus | ''>('')
  const [reason, setReason] = useState('')

  const mutation = useMutation({
    mutationFn: (body: { status: ApplicationStatus; reason?: string }) =>
      apiPatch(`/api/applications/${applicationId}`, body),
    onSuccess: () => {
      toast.success('Status updated')
      onOpenChange(false)
      setNewStatus('')
      setReason('')
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['officer-applications'] })
      qc.invalidateQueries({ queryKey: ['officer-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to update status')
    },
  })

  function submit() {
    if (!newStatus) {
      toast.error('Select a status')
      return
    }
    mutation.mutate({ status: newStatus, reason: reason.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setNewStatus(''); setReason('') }; onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update application status</DialogTitle>
          <DialogDescription>
            Current: <StatusBadge status={currentStatus} />
            {allowedNext.length === 0 ? ' — terminal status, no further transitions.' : ' Select the next status.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">New status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ApplicationStatus)}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {allowedNext.map((s) => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the transition…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending || allowedNext.length === 0}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScheduleInterviewDialog({
  open, onOpenChange, applicationId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
}) {
  const qc = useQueryClient()
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [type, setType] = useState<'TECHNICAL' | 'HR' | 'MANAGERIAL' | 'GROUP'>('TECHNICAL')
  const [round, setRound] = useState('1')
  const [notes, setNotes] = useState('')

  function reset() {
    setScheduledAt(''); setDuration(''); setLocation(''); setMeetingUrl('')
    setType('TECHNICAL'); setRound('1'); setNotes('')
  }

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost(`/api/applications/${applicationId}/interview`, body),
    onSuccess: () => {
      toast.success('Interview scheduled — student notified')
      onOpenChange(false)
      reset()
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['officer-applications'] })
      qc.invalidateQueries({ queryKey: ['officer-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to schedule interview')
    },
  })

  function submit() {
    if (!scheduledAt) {
      toast.error('Pick a date & time')
      return
    }
    const body: Record<string, unknown> = {
      scheduledAt: new Date(scheduledAt).toISOString(),
      type,
      round: Number(round) || 1,
    }
    if (duration) body.duration = Number(duration)
    if (location) body.location = location
    if (meetingUrl) body.meetingUrl = meetingUrl
    if (notes) body.notes = notes
    mutation.mutate(body)
  }

  // Default to next day 10am
  function setDefaultTime() {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(10, 0, 0, 0)
    const tz = d.getTimezoneOffset() * 60000
    const local = new Date(d.getTime() - tz).toISOString().slice(0, 16)
    setScheduledAt(local)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule interview</DialogTitle>
          <DialogDescription>If the application is at an earlier stage, it will be advanced to INTERVIEW.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Scheduled at *</Label>
            <div className="flex gap-2">
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={setDefaultTime}>Now+1d 10am</Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {INTERVIEW_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Round</Label>
            <Input type="number" min={1} max={20} value={round} onChange={(e) => setRound(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Duration (min)</Label>
            <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 60" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / room" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Meeting URL</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet…" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes for student" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            Schedule
          </Button>
        </DialogFooter>
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
  const [decision, setDecision] = useState<'PENDING' | 'ACCEPTED' | 'DECLINED'>(existingOffer?.decision as 'PENDING' | 'ACCEPTED' | 'DECLINED' ?? 'PENDING')
  const [expiresAt, setExpiresAt] = useState('')

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost(`/api/applications/${applicationId}/offer`, body),
    onSuccess: () => {
      toast.success('Offer updated — student notified')
      onOpenChange(false)
      qc.invalidateQueries({ queryKey: ['application', applicationId] })
      qc.invalidateQueries({ queryKey: ['officer-applications'] })
      qc.invalidateQueries({ queryKey: ['officer-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to extend offer')
    },
  })

  function submit() {
    const body: Record<string, unknown> = {
      currency,
      decision,
    }
    if (amount) body.amount = Number(amount)
    if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString()
    mutation.mutate(body)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existingOffer ? 'Update offer' : 'Extend offer'}
          </DialogTitle>
          <DialogDescription>
            The application status will be moved to OFFER if it's at an earlier stage.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Amount</Label>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1200000" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="INR" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Decision</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as typeof decision)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {OFFER_DECISIONS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Expires at</Label>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            {existingOffer ? 'Update offer' : 'Extend offer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApplicationDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading application…" description="Hang tight" />
      <CardSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
