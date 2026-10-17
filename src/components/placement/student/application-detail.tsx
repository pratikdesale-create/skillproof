'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Briefcase, MapPin, Calendar, Video, ExternalLink,
  FileText, Clock, ArrowRight, DollarSign, History, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ApplicationEvent, ApplicationStatus, Interview, Offer } from '@/types'

interface AppJob { id: string; title: string; company: { id: string; name: string } }
interface AppResume { id: string; title: string; version: number }
interface AppStudent { id: string; user: { id: string; name: string; email: string } }

interface ApplicationDetail {
  id: string
  studentId: string
  student?: AppStudent
  jobId: string
  job?: AppJob & { location?: string | null }
  resume?: AppResume | null
  status: ApplicationStatus
  appliedAt: string
  coverLetter?: string | null
  notes?: string | null
  events?: (ApplicationEvent & { actor?: { id: string; name: string } | null })[]
  interviews?: Interview[]
  offer?: Offer | null
}

const isTerminal = (s: ApplicationStatus) => s === 'REJECTED' || s === 'WITHDRAWN'

export function ApplicationDetail({ id }: { id: string }) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery<ApplicationDetail>({
    queryKey: ['application', id],
    queryFn: () => apiGet<ApplicationDetail>(`/api/applications/${id}`),
    staleTime: 30_000,
  })

  const withdrawMutation = useMutation({
    mutationFn: () => apiPatch(`/api/applications/${id}`, {
      status: 'WITHDRAWN',
      reason: 'Student withdrew',
    }),
    onSuccess: () => {
      toast.success('Application withdrawn')
      qc.invalidateQueries({ queryKey: ['application', id] })
      qc.invalidateQueries({ queryKey: ['applications'] })
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to withdraw')
    },
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
  const events = data.events ?? []
  const interviews = (data.interviews ?? []).filter(i => !i.outcome)
  const offer = data.offer

  // Chronological events (oldest first for timeline)
  const timeline = [...events].reverse()

  return (
    <div className="space-y-6">
      <PageHeader
        title={job?.title ?? 'Application'}
        description={`${job?.company.name ?? ''}${job?.location ? ` · ${job.location}` : ''}`}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('student/applications')}>
          <ArrowLeft className="size-4 mr-1" /> All applications
        </Button>
        {job && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`student/jobs/${job.id}`)}>
            <Briefcase className="size-4 mr-1" /> View job
          </Button>
        )}
      </PageHeader>

      {/* Status banner */}
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Current status</div>
              <div className="mt-1"><StatusBadge status={data.status} /></div>
            </div>
            <div className="border-l pl-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Applied</div>
              <div className="text-sm font-medium mt-1">{formatDate(data.appliedAt)}</div>
            </div>
            {data.resume && (
              <div className="border-l pl-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Resume</div>
                <button
                  className="text-sm font-medium text-foreground underline mt-1 inline-flex items-center gap-1"
                  onClick={() => navigate(`student/resumes/${data.resume!.id}`)}
                >
                  <FileText className="size-3" /> {data.resume.title}
                </button>
              </div>
            )}
          </div>
          {!isTerminal(data.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-[var(--danger-foreground)] border-[var(--danger)]/40 hover:bg-[var(--danger-muted)] hover:text-[var(--danger-foreground)]">
                  <XCircle className="size-4 mr-1" /> Withdraw
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Withdraw application?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. You will lose your place in the pipeline for{' '}
                    <span className="font-medium">{job?.title}</span>.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => withdrawMutation.mutate()}
                    disabled={withdrawMutation.isPending}
                    className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-[var(--danger-foreground)]"
                  >
                    {withdrawMutation.isPending ? 'Withdrawing…' : 'Withdraw application'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: cover letter */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cover letter</CardTitle>
            <CardDescription>As submitted with your application</CardDescription>
          </CardHeader>
          <CardContent>
            {data.coverLetter ? (
              <p className="text-sm whitespace-pre-wrap text-foreground/90 leading-relaxed">
                {data.coverLetter}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No cover letter was attached to this application.
              </p>
            )}
            {data.notes && (
              <div className="mt-4 p-3 rounded-md bg-[var(--pending-muted)] border border-[var(--pending)]/30 text-sm text-[var(--pending-foreground)]">
                <span className="font-medium">Internal notes:</span> {data.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: offer / interview summary / submitted resume */}
        <div className="space-y-6">
          {offer && (
            <Card className="border-[var(--verified)]/30 bg-[var(--verified-muted)]">
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
                        <Badge variant="outline" className="text-xs capitalize">{iv.type}</Badge>
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
                          className="text-xs text-muted-foreground hover:text-foreground underline inline-flex items-center gap-1"
                        >
                          <Video className="size-3" /> Join meeting
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                      {iv.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{iv.notes}</p>
                      )}
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
                <button
                  className="w-full text-left text-sm hover:underline flex items-center justify-between"
                  onClick={() => navigate(`student/resumes/${data.resume!.id}`)}
                >
                  <span className="font-medium">{data.resume.title}</span>
                  <ArrowRight className="size-3" />
                </button>
                <p className="text-xs text-muted-foreground mt-1">Version {data.resume.version}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

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
                    'absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-background',
                    i === timeline.length - 1 ? 'bg-foreground' : 'bg-muted-foreground/50'
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
  )
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
