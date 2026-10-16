'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPatch } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, CardSkeleton, EmptyState, ErrorState, formatCurrency, formatDate, formatDateTime } from '@/components/placement/shared/ui'
import { StatusBadge } from '@/components/placement/shared/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Briefcase, MapPin, Building2, Calendar, Video, ExternalLink,
  FileText, Clock, ArrowRight, DollarSign, History, XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
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
              <div className="text-xs uppercase tracking-wider text-slate-500">Current status</div>
              <div className="mt-1"><StatusBadge status={data.status} className="text-sm" /></div>
            </div>
            <div className="border-l pl-4">
              <div className="text-xs uppercase tracking-wider text-slate-500">Applied</div>
              <div className="text-sm font-medium mt-1">{formatDate(data.appliedAt)}</div>
            </div>
            {data.resume && (
              <div className="border-l pl-4">
                <div className="text-xs uppercase tracking-wider text-slate-500">Resume</div>
                <button
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 underline mt-1 inline-flex items-center gap-1"
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
                <Button variant="outline" size="sm" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900 dark:hover:bg-rose-950">
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
                    className="bg-rose-600 hover:bg-rose-700 text-white"
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
              <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">
                {data.coverLetter}
              </p>
            ) : (
              <p className="text-sm text-slate-500 italic">
                No cover letter was attached to this application.
              </p>
            )}
            {data.notes && (
              <div className="mt-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-300">
                <span className="font-medium">Internal notes:</span> {data.notes}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: offer / interview summary */}
        <div className="space-y-6">
          {offer && (
            <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/40">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <DollarSign className="size-4" /> Offer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {offer.amount != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Compensation</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(offer.amount, offer.currency ?? 'INR')}
                    </span>
                  </div>
                )}
                {offer.currency && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Currency</span>
                    <span className="font-medium">{offer.currency}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Decision</span>
                  <StatusBadge status={offer.decision} />
                </div>
                {offer.expiresAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Expires</span>
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
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="size-3" /> {iv.location}
                        </div>
                      )}
                      {iv.meetingUrl && (
                        <a
                          href={iv.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-600 dark:text-slate-400 hover:underline inline-flex items-center gap-1"
                        >
                          <Video className="size-3" /> Join meeting
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                      {iv.notes && (
                        <p className="text-xs text-slate-500 mt-1">{iv.notes}</p>
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
                <p className="text-xs text-slate-500 mt-1">Version {data.resume.version}</p>
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
            <p className="text-sm text-slate-500">No events recorded.</p>
          ) : (
            <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-3 space-y-4">
              {timeline.map((e, i) => (
                <li key={e.id} className="pl-4 relative">
                  <span className={`absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-white dark:border-slate-950 ${
                    i === timeline.length - 1
                      ? 'bg-slate-900 dark:bg-slate-100'
                      : 'bg-slate-300 dark:bg-slate-700'
                  }`} />
                  <div className="flex flex-wrap items-center gap-2">
                    {e.previousStatus && <StatusBadge status={e.previousStatus} />}
                    {e.previousStatus && <ArrowRight className="size-3 text-slate-400" />}
                    <StatusBadge status={e.newStatus} />
                    <span className="text-xs text-slate-500 ml-auto">{formatDateTime(e.timestamp)}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
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
