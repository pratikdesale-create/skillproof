'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { EvidenceStatus, ApplicationStatus, JobStatus, ClaimStatus } from '@/types'

const STATUS_STYLES: Record<string, string> = {
  // Evidence
  VERIFIED: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  PENDING_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  UNVERIFIED: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
  NEEDS_MORE_EVIDENCE: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',

  // Application status
  APPLIED: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  SHORTLISTED: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300',
  ASSESSMENT: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300',
  INTERVIEW: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300',
  OFFER: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
  WITHDRAWN: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300',

  // Claim status
  SUPPORTED: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300',
  UNSUPPORTED: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending Review',
  NEEDS_MORE_EVIDENCE: 'Needs More Evidence',
  UNDER_REVIEW: 'Under Review',
  NEEDS_REVIEW: 'Needs Review',
}

export function StatusBadge({
  status,
  className,
}: {
  status: EvidenceStatus | ApplicationStatus | JobStatus | ClaimStatus | string
  className?: string
}) {
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge variant="outline" className={cn('font-medium', STATUS_STYLES[status] ?? '', className)}>
      {label}
    </Badge>
  )
}

export function FitScoreBadge({ score, className }: { score: number; className?: string }) {
  const color =
    score >= 75 ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
    : score >= 50 ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
    : score >= 25 ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300'
    : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
  return (
    <Badge variant="outline" className={cn('font-semibold tabular-nums', color, className)}>
      {score.toFixed(1)}%
    </Badge>
  )
}

export function CoverageBadge({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100)
  const color =
    value >= 0.8 ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
    : value >= 0.5 ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
    : 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
  return (
    <Badge variant="outline" className={cn('font-semibold tabular-nums', color, className)}>
      {pct}% covered
    </Badge>
  )
}
