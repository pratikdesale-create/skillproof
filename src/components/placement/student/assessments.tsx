'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState,
  SectionHeader, formatDate,
} from '@/components/placement/shared/ui'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  ClipboardList, Award, Clock, Building2, Trophy, Percent, CheckCircle2, Info,
} from 'lucide-react'

interface AssessmentSkill {
  id: string
  displayName: string
  canonicalName: string
  category?: string | null
}
interface AssessmentResult {
  id: string
  score: number
  percentile?: number | null
  date: string
  studentId: string
}
interface Assessment {
  id: string
  name: string
  organization: string
  description?: string | null
  maxScore: number
  skill: AssessmentSkill
  submissions: number
  avgScore: number | null
  myResult: AssessmentResult | null
}
interface AssessmentsResponse { data: Assessment[] }

export function Assessments() {
  const { data, isLoading, isError, error, refetch } = useQuery<AssessmentsResponse>({
    queryKey: ['assessments'],
    queryFn: () => apiGet<AssessmentsResponse>('/api/assessments'),
    staleTime: 60_000,
  })

  const [openAssessment, setOpenAssessment] = useState<Assessment | null>(null)

  if (isLoading) return <AssessmentsSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load assessments'}
        onRetry={() => refetch()}
      />
    )
  }

  const assessments = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Standardized skill assessments you can take to verify your claims"
      />

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={ClipboardList}
              title="No assessments configured yet"
              description="Your placement officer will publish assessments here as they become available."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="rounded-md border border-[var(--info)]/30 bg-[var(--info-muted)] p-3 flex items-start gap-2 text-xs text-[var(--info-foreground)]">
            <Info className="size-4 shrink-0 mt-0.5" />
            <p>
              Placement Hub records your scores but does not host question banks or proctor exams.
              Contact your placement officer for instructions and proctoring details before taking an assessment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessments.map((a) => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                onStart={() => setOpenAssessment(a)}
              />
            ))}
          </div>
        </>
      )}

      {openAssessment && (
        <AssessmentStartDialog
          assessment={openAssessment}
          onClose={() => setOpenAssessment(null)}
        />
      )}
    </div>
  )
}

function AssessmentCard({
  assessment, onStart,
}: {
  assessment: Assessment
  onStart: () => void
}) {
  const hasResult = Boolean(assessment.myResult)
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base leading-tight">{assessment.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5 mt-1">
              <Building2 className="size-3.5" />
              {assessment.organization}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">
            <Award className="size-3 mr-1" /> Max {assessment.maxScore}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {assessment.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{assessment.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Relevant skill:</span>
          <SkillTag name={assessment.skill.displayName} />
        </div>
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5" /> Duration approx — ask assessor
          </div>
          <div className="text-muted-foreground">
            {assessment.submissions > 0
              ? `${assessment.submissions} student${assessment.submissions === 1 ? '' : 's'} took this`
              : 'Not taken yet'}
          </div>
        </div>

        {hasResult && (
          <div className="rounded-md border border-[var(--verified)]/30 bg-[var(--verified-muted)] p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[var(--verified-foreground)]">
              <CheckCircle2 className="size-3.5" /> Your most recent result
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground">Score</div>
                <div className="font-semibold tabular-nums flex items-center gap-1">
                  <Trophy className="size-3" />
                  {assessment.myResult!.score} / {assessment.maxScore}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Percentile</div>
                <div className="font-semibold tabular-nums flex items-center gap-1">
                  <Percent className="size-3" />
                  {assessment.myResult!.percentile ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Date</div>
                <div className="font-medium">{formatDate(assessment.myResult!.date)}</div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Past attempts beyond the most recent are not exposed in this MVP.
            </p>
          </div>
        )}

        <div className="mt-auto pt-2 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {assessment.avgScore != null
              ? `Avg score: ${assessment.avgScore.toFixed(1)}`
              : 'No averages yet'}
          </span>
          <Button size="sm" onClick={onStart}>
            {hasResult ? 'Retake' : 'Start'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AssessmentStartDialog({
  assessment, onClose,
}: {
  assessment: Assessment
  onClose: () => void
}) {
  // Generate 1-2 deterministic sample questions based on the relevant skill.
  const sampleQs = [
    `Describe a real-world scenario where you applied ${assessment.skill.displayName}.`,
    `Walk through your approach to a common ${assessment.skill.displayName} problem and trade-offs you considered.`,
  ]
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start assessment: {assessment.name}</DialogTitle>
          <DialogDescription>
            {assessment.organization} · verifies{' '}
            <span className="font-medium text-foreground">{assessment.skill.displayName}</span>{' '}
            · max score {assessment.maxScore}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Instructions
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              Ask your placement officer for proctoring details, scoring rubric, and any pre-read materials specific to this assessment. Placement Hub does not host question banks or proctor exams in this MVP.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              Sample question prompts (illustrative)
            </div>
            <ol className="space-y-2 text-sm text-foreground/90">
              {sampleQs.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">{i + 1}.</span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
            <p className="text-[10px] text-muted-foreground">
              These are generic prompts to help you prepare. Actual questions differ in each sitting.
            </p>
          </div>

          <div className="rounded-md border border-[var(--pending)]/30 bg-[var(--pending-muted)] p-3 text-xs text-[var(--pending-foreground)]">
            <Info className="size-3.5 inline mr-1" />
            Once you complete the assessment, your placement officer will record your score and percentile here.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AssessmentsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Assessments" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
