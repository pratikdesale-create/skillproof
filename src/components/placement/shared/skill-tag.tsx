'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle, Clock, XCircle, HelpCircle } from 'lucide-react'
import type { EvidenceStatus } from '@/types'

const STATUS_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  VERIFIED: { label: 'Verified', icon: CheckCircle2, cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900' },
  PENDING_REVIEW: { label: 'Pending', icon: Clock, cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900' },
  UNVERIFIED: { label: 'Unverified', icon: HelpCircle, cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800' },
  REJECTED: { label: 'Rejected', icon: XCircle, cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900' },
  NEEDS_MORE_EVIDENCE: { label: 'Needs more', icon: AlertTriangle, cls: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-900' },
}

export function SkillTag({
  name,
  isRequired,
  isVerified,
  size = 'default',
}: {
  name: string
  isRequired?: boolean
  isVerified?: boolean
  size?: 'default' | 'sm'
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium',
        size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs',
        isVerified
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300',
        isRequired && 'ring-1 ring-rose-200 dark:ring-rose-900'
      )}
    >
      {name}
      {isRequired && <span className="ml-1 text-rose-500">*</span>}
    </Badge>
  )
}

export function EvidenceStatusBadge({ status, size = 'default' }: { status: EvidenceStatus; size?: 'default' | 'sm' }) {
  const meta = STATUS_META[status] ?? STATUS_META.UNVERIFIED
  const Icon = meta.icon
  return (
    <Badge
      variant="outline"
      className={cn('font-medium gap-1', size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs', meta.cls)}
    >
      <Icon className={size === 'sm' ? 'size-2.5' : 'size-3'} />
      {meta.label}
    </Badge>
  )
}
