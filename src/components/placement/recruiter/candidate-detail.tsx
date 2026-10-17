'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, ProgressRing, formatDate,
} from '@/components/placement/shared/ui'
import { CoverageBadge, StatusBadge, FitScoreBadge } from '@/components/placement/shared/status-badge'
import { SkillTag, EvidenceStatusBadge } from '@/components/placement/shared/skill-tag'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ArrowLeft, Mail, MapPin, GraduationCap, Github, Linkedin, Globe, Award,
  Target, ShieldCheck, Calendar, Video, ExternalLink, Lightbulb, AlertTriangle, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ApplicationStatus, EvidenceStatus } from '@/types'

interface CandidateSkill {
  id: string
  skillId: string
  name: string
  category?: string | null
  selfRated?: string | null
  isVerified: boolean
  source?: string | null
  addedAt: string
}
interface CandidateEvidence {
  id: string
  type: string
  title: string
  status: EvidenceStatus
  submittedAt: string
  sourceUrl?: string | null
  organization?: string | null
  score?: number | null
  maxScore?: number | null
}
interface CandidateProfile {
  id: string
  userId: string
  name: string
  email: string
  avatarUrl?: string | null
  phone?: string | null
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
  skills: CandidateSkill[]
  evidence: CandidateEvidence[]
  applicationsCount: number
}

interface MissingSkillRow { skillId: string; name: string; weight: number; isRequired: boolean; status: string }
interface MatchingSkillRow { skillId: string; name: string; evidenceIds: string[] }

interface PairMatch {
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: MatchingSkillRow[]
  missingSkills: MissingSkillRow[]
  factorsSummary: string
  recommendation: string
  algorithmVersion: string
  storedAt?: string | null
}

interface ApplicationRow {
  id: string
  studentId: string
  jobId: string
  jobTitle: string
  companyName: string
  status: ApplicationStatus
  appliedAt: string
}
interface ApplicationsResponse { data: ApplicationRow[]; total: number }

const INTERVIEW_TYPES = ['TECHNICAL', 'HR', 'MANAGERIAL', 'GROUP'] as const

export function CandidateDetail({ id, jobId }: { id: string; jobId?: string }) {
  const navigate = useAppStore(s => s.navigate)
  const profileQuery = useQuery<CandidateProfile>({
    queryKey: ['candidate', id],
    queryFn: () => apiGet<CandidateProfile>(`/api/students/${id}`),
    staleTime: 60_000,
  })
  const matchQuery = useQuery<PairMatch>({
    queryKey: ['pair-match', jobId, id],
    queryFn: () => apiGet<PairMatch>(`/api/matches/${jobId}/${id}`),
    enabled: Boolean(jobId),
    staleTime: 60_000,
  })

  // All applications for this student — the API auto-filters by recruiter's company
  const appsQuery = useQuery<ApplicationsResponse>({
    queryKey: ['recruiter-applications', 'student', id],
    queryFn: () => apiGet<ApplicationsResponse>('/api/applications'),
    enabled: Boolean(jobId),
    staleTime: 30_000,
  })
  const studentApps = (appsQuery.data?.data ?? []).filter(a => a.studentId === id)
  const existingAppForJob = studentApps.find(a => a.jobId === jobId) ?? null

  const loading = profileQuery.isLoading
  const loadErr = profileQuery.error as Error | null

  if (loading) return <CandidateDetailSkeleton />
  if (loadErr) {
    return (
      <ErrorState
        message={loadErr.message ?? 'Failed to load candidate'}
        onRetry={() => profileQuery.refetch()}
      />
    )
  }
  if (!profileQuery.data) {
    return <ErrorState message="Candidate not found" onRetry={() => profileQuery.refetch()} />
  }

  const candidate = profileQuery.data
  const match = matchQuery.data
  const verifiedSkills = candidate.skills.filter(s => s.isVerified)
  const unverifiedSkills = candidate.skills.filter(s => !s.isVerified)

  return (
    <div className="space-y-6">
      <PageHeader
        title={candidate.name}
        description={candidate.email}
        breadcrumbs={[
          { label: 'Candidate shortlists' },
          { label: candidate.name },
        ]}
      >
        <Button variant="outline" size="sm" onClick={() => navigate('recruiter/shortlist', jobId ? { jobId } : undefined)}>
          <ArrowLeft className="size-4 mr-1" /> Back to shortlist
        </Button>
      </PageHeader>

      {/* Candidate header card */}
      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Field label="University" value={candidate.university ?? '—'} icon={<GraduationCap className="size-3" />} />
                <Field label="Batch" value={candidate.batch ?? '—'} />
                <Field label="Branch" value={candidate.branch ?? '—'} />
                <Field label="CGPA" value={candidate.cgpa != null ? candidate.cgpa.toFixed(2) : '—'} />
                <Field label="Graduation" value={candidate.graduationYear != null ? String(candidate.graduationYear) : '—'} />
                <Field label="Location" value={candidate.location ?? '—'} icon={<MapPin className="size-3" />} />
              </div>
              {candidate.bio && (
                <p className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                  {candidate.bio}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Field label="Email" value={candidate.email} icon={<Mail className="size-3" />} compact />
                {candidate.githubUser && (
                  <a
                    href={`https://github.com/${candidate.githubUser}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline border rounded px-2 py-1 bg-card"
                  >
                    <Github className="size-3" /> {candidate.githubUser}
                  </a>
                )}
                {candidate.linkedinUrl && (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline border rounded px-2 py-1 bg-card"
                  >
                    <Linkedin className="size-3" /> LinkedIn
                  </a>
                )}
                {candidate.portfolioUrl && (
                  <a
                    href={candidate.portfolioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline border rounded px-2 py-1 bg-card"
                  >
                    <Globe className="size-3" /> Portfolio
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ProgressRing value={candidate.profileCompletion} size={72} strokeWidth={6} label="complete" />
              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Profile</div>
                <div className="text-2xl font-bold tabular-nums">{candidate.profileCompletion}%</div>
                <div className="text-xs text-muted-foreground">{candidate.applicationsCount} application{candidate.applicationsCount === 1 ? '' : 's'} total</div>
                <div className="text-xs text-muted-foreground">
                  {verifiedSkills.length} verified · {unverifiedSkills.length} unverified skills
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Skills + Evidence */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4" /> Skills
                <Badge variant="outline" className="text-xs">{candidate.skills.length}</Badge>
              </CardTitle>
              <CardDescription>Verified skills are backed by approved evidence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-medium text-[var(--verified-foreground)] mb-2">
                  Verified ({verifiedSkills.length})
                </div>
                {verifiedSkills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No verified skills yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {verifiedSkills.map(s => (
                      <SkillTag key={s.id} name={s.name} isVerified />
                    ))}
                  </div>
                )}
              </div>
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Unverified ({unverifiedSkills.length})
                </div>
                {unverifiedSkills.length === 0 ? (
                  <p className="text-xs text-muted-foreground">None — every skill is backed by evidence</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {unverifiedSkills.map(s => (
                      <SkillTag key={s.id} name={s.name} />
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="size-4" /> Evidence
                <Badge variant="outline" className="text-xs">{candidate.evidence.length}</Badge>
              </CardTitle>
              <CardDescription>Submitted proofs of skill</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {candidate.evidence.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No evidence submitted"
                  description="This candidate has not yet submitted any proof of skill"
                />
              ) : (
                <ScrollArea className="max-h-96 scroll-area-thin">
                  <ul className="divide-y">
                    {candidate.evidence.map(ev => (
                      <li key={ev.id} className="p-3 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{ev.title}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              <Badge variant="secondary" className="text-[10px] mr-1">{ev.type}</Badge>
                              {ev.organization && <span className="mr-2">· {ev.organization}</span>}
                              {ev.submittedAt && <span>· {formatDate(ev.submittedAt)}</span>}
                            </div>
                          </div>
                          <EvidenceStatusBadge status={ev.status} size="sm" />
                        </div>
                        {(ev.score != null || ev.sourceUrl) && (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {ev.score != null && (
                              <span>
                                Score: <span className="font-medium tabular-nums">{ev.score}{ev.maxScore != null ? ` / ${ev.maxScore}` : ''}</span>
                              </span>
                            )}
                            {ev.sourceUrl && (
                              <a
                                href={ev.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 hover:underline"
                                onClick={e => e.stopPropagation()}
                              >
                                <ExternalLink className="size-3" /> Source
                              </a>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Applications summary for this candidate to the recruiter's company */}
          {jobId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="size-4" /> Applications to your company
                </CardTitle>
                <CardDescription>
                  {studentApps.length} application{studentApps.length === 1 ? '' : 's'} from this candidate
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {appsQuery.isLoading ? (
                  <div className="p-4 space-y-2">
                    {[0, 1].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : studentApps.length === 0 ? (
                  <EmptyState
                    icon={User}
                    title="No applications yet"
                    description="This candidate has not applied to any of your company's jobs"
                  />
                ) : (
                  <ul className="divide-y">
                    {studentApps.map(a => (
                      <li
                        key={a.id}
                        className="p-3 hover:bg-muted/40 cursor-pointer"
                        onClick={() => navigate('recruiter/applications', { id: a.id })}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{a.jobTitle}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Applied {formatDate(a.appliedAt)}
                            </div>
                          </div>
                          <StatusBadge status={a.status} size="sm" />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Fit analysis + interview scheduling */}
        <div className="space-y-6">
          {!jobId && (
            <Card>
              <CardContent className="p-4">
                <EmptyState
                  icon={Target}
                  title="No job selected"
                  description="Fit analysis requires a specific job — go back and pick one"
                />
              </CardContent>
            </Card>
          )}
          {jobId && matchQuery.isLoading && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-16 w-24 mx-auto" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          )}
          {jobId && matchQuery.isError && (
            <Card>
              <CardContent className="p-4">
                <EmptyState
                  icon={Target}
                  title="Fit analysis unavailable"
                  description={(matchQuery.error as Error)?.message ?? 'Could not compute match'}
                />
              </CardContent>
            </Card>
          )}
          {jobId && match && (
            <FitAnalysisPanel match={match} />
          )}

          {/* Interview scheduling */}
          {jobId && (
            <InterviewPanel
              jobId={jobId}
              existingApp={existingAppForJob}
              appsLoading={appsQuery.isLoading}
              studentApps={studentApps}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, icon, compact }: { label: string; value: string; icon?: React.ReactNode; compact?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('font-medium flex items-center gap-1', compact ? 'text-xs' : 'text-sm')}>
        {icon}
        {value}
      </div>
    </div>
  )
}

function FitAnalysisPanel({ match }: { match: PairMatch }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="size-4" /> Fit analysis
        </CardTitle>
        <CardDescription>Live computed match for this role</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center text-center py-4">
          <FitScoreBadge score={match.fitScore} size="lg" className="text-2xl" />
          <div className="text-xs text-muted-foreground mt-2">fit score</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Required cov.</div>
            <CoverageBadge value={match.requiredCoverage} />
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Preferred cov.</div>
            <CoverageBadge value={match.preferredCoverage} />
          </div>
        </div>
        {match.factorsSummary && (
          <div className="text-xs text-muted-foreground bg-muted rounded-md p-3">
            <Lightbulb className="size-3.5 inline mr-1" />
            {match.factorsSummary}
          </div>
        )}
        {match.recommendation && (
          <div className={cn(
            'text-xs rounded-md p-3 border',
            match.fitScore >= 50
              ? 'bg-[var(--verified-muted)] border-[var(--verified)]/30 text-[var(--verified-foreground)]'
              : 'bg-[var(--pending-muted)] border-[var(--pending)]/30 text-[var(--pending-foreground)]'
          )}>
            <span className="font-medium">Recommendation:</span> {match.recommendation}
          </div>
        )}
        <div className="text-xs text-muted-foreground pt-1 border-t flex items-center justify-between">
          <span>Algorithm v{match.algorithmVersion}</span>
          {match.storedAt && <span>Last computed {formatDate(match.storedAt)}</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Matching</div>
            <div className="text-lg font-semibold tabular-nums">{match.matchingSkills.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Missing</div>
            <div className="text-lg font-semibold tabular-nums">{match.missingSkills.length}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InterviewPanel({
  jobId, existingApp, appsLoading, studentApps,
}: {
  jobId: string
  existingApp: ApplicationRow | null
  appsLoading: boolean
  studentApps: ApplicationRow[]
}) {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [duration, setDuration] = useState('')
  const [location, setLocation] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [type, setType] = useState<string>('TECHNICAL')
  const [round, setRound] = useState('1')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!existingApp) throw new Error('No existing application for this candidate')
      const body: Record<string, unknown> = {
        scheduledAt: new Date(scheduledAt).toISOString(),
        type,
        round: parseInt(round, 10) || 1,
      }
      if (duration.trim()) body.duration = parseInt(duration, 10)
      if (location.trim()) body.location = location.trim()
      if (meetingUrl.trim()) body.meetingUrl = meetingUrl.trim()
      if (notes.trim()) body.notes = notes.trim()
      return apiPost(`/api/applications/${existingApp.id}/interview`, body)
    },
    onSuccess: () => {
      toast.success('Interview scheduled')
      qc.invalidateQueries({ queryKey: ['recruiter-applications', 'student'] })
      qc.invalidateQueries({ queryKey: ['application', existingApp?.id] })
      setOpen(false)
      // Reset
      setScheduledAt('')
      setDuration('')
      setLocation('')
      setMeetingUrl('')
      setNotes('')
      setRound('1')
      setType('TECHNICAL')
      // Navigate to the application detail
      if (existingApp) navigate('recruiter/applications', { id: existingApp.id })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to schedule interview')
    },
  })

  if (appsLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!existingApp) {
    return (
      <Card className="border-[var(--pending)]/30 bg-[var(--pending-muted)]/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-[var(--pending-foreground)]">
            <AlertTriangle className="size-4" /> No active application
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--pending-foreground)]">
            This candidate has not applied to this job yet. Recruiters cannot create applications — ask the placement officer to advance this candidate to APPLIED or SHORTLISTED first.
          </p>
          {studentApps.length > 0 && (
            <div className="text-xs text-[var(--pending-foreground)] bg-card rounded-md p-2 border border-[var(--pending)]/20">
              They have {studentApps.length} other application{studentApps.length === 1 ? '' : 's'} to your company — review them in the pipeline.
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="size-4" /> Schedule interview
        </CardTitle>
        <CardDescription>
          Application: <StatusBadge status={existingApp.status} size="sm" className="ml-1" />
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Scheduling an interview will automatically advance the application to INTERVIEW stage if it isn't already.
        </p>
        <Button className="w-full" onClick={() => setOpen(true)}>
          <Video className="size-4 mr-2" /> Schedule interview
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Schedule interview</DialogTitle>
              <DialogDescription>
                All times in your local timezone. The candidate will receive a notification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scroll-area-thin">
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
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !scheduledAt}>
                {mutation.isPending ? 'Scheduling…' : 'Schedule interview'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function CandidateDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Loading candidate…" description="Hang tight" />
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2"><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
      </div>
    </div>
  )
}
