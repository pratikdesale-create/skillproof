'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { EvidenceStatus, ApplicationStatus, JobStatus, ClaimStatus } from '@/types'

// Semantic status badges using the design-system tokens defined in globals.css.
// Colors are paired with text labels so they're never the only indicator.

const STATUS_STYLES: Record<string, string> = {
  // Evidence statuses
  VERIFIED: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  PENDING_REVIEW: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
  UNVERIFIED: 'bg-muted text-muted-foreground border-border',
  REJECTED: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  NEEDS_MORE_EVIDENCE: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',

  // Application statuses
  APPLIED: 'bg-[var(--info-muted)] text-[var(--info-foreground)] border-[var(--info)]/30',
  UNDER_REVIEW: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
  SHORTLISTED: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900',
  ASSESSMENT: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-900',
  INTERVIEW: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900',
  OFFER: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  // REJECTED, WITHDRAWN use danger/muted above

  // Claim statuses
  SUPPORTED: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)] border-[var(--verified)]/30',
  UNSUPPORTED: 'bg-[var(--danger-muted)] text-[var(--danger-foreground)] border-[var(--danger)]/30',
  NEEDS_REVIEW: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)] border-[var(--pending)]/30',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_REVIEW: 'Pending review',
  NEEDS_MORE_EVIDENCE: 'Needs more evidence',
  UNDER_REVIEW: 'Under review',
  NEEDS_REVIEW: 'Needs review',
  UNVERIFIED: 'Unverified',
}

export function StatusBadge({
  status,
  className,
  size = 'default',
}: {
  status: EvidenceStatus | ApplicationStatus | JobStatus | ClaimStatus | string
  className?: string
  size?: 'default' | 'sm'
}) {
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
        STATUS_STYLES[status] ?? '',
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </Badge>
  )
}

export function FitScoreBadge({ score, className, size = 'default' }: { score: number; className?: string; size?: 'default' | 'sm' | 'lg' }) {
  const tone =
    score >= 75 ? 'text-[var(--verified-foreground)] bg-[var(--verified-muted)] border-[var(--verified)]/30'
    : score >= 50 ? 'text-[var(--pending-foreground)] bg-[var(--pending-muted)] border-[var(--pending)]/30'
    : score >= 25 ? 'text-[var(--pending-foreground)] bg-[var(--pending-muted)]/60 border-[var(--pending)]/30'
    : 'text-[var(--danger-foreground)] bg-[var(--danger-muted)] border-[var(--danger)]/30'
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-semibold tabular-nums gap-1',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : size === 'lg' ? 'text-sm px-2.5 py-1' : 'text-xs px-2 py-0.5',
        tone,
        className
      )}
      title={`Fit score: ${score.toFixed(1)}%`}
    >
      {score.toFixed(1)}%
    </Badge>
  )
}

export function CoverageBadge({ value, className, label = 'covered' }: { value: number; className?: string; label?: string }) {
  const pct = Math.round(value * 100)
  const tone =
    value >= 0.8 ? 'text-[var(--verified-foreground)] bg-[var(--verified-muted)] border-[var(--verified)]/30'
    : value >= 0.5 ? 'text-[var(--pending-foreground)] bg-[var(--pending-muted)] border-[var(--pending)]/30'
    : 'text-[var(--danger-foreground)] bg-[var(--danger-muted)] border-[var(--danger)]/30'
  return (
    <Badge variant="outline" className={cn('font-semibold tabular-nums', tone, className)}>
      {pct}% {label}
    </Badge>
  )
}

// Mini progress bar for inline fit visualization
export function MiniBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const tone =
    v >= 75 ? 'bg-[var(--verified)]'
    : v >= 50 ? 'bg-[var(--pending)]'
    : v >= 25 ? 'bg-[var(--pending)]'
    : 'bg-[var(--danger)]'
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-muted overflow-hidden', className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${v}%` }} />
    </div>
  )
}
