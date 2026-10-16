'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title, description, children,
}: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardContent className="p-6 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-8 w-1/3 mt-2" />
      </CardContent>
    </Card>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="size-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mb-4">
        <Icon className="size-5 text-slate-500" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-950 flex items-center justify-center mb-4">
        <span className="text-rose-600 font-bold">!</span>
      </div>
      <h3 className="text-base font-medium">Something went wrong</h3>
      <p className="text-sm text-slate-500 mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm text-slate-700 dark:text-slate-300 underline">
          Try again
        </button>
      )}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones: Record<string, string> = {
    default: 'bg-white dark:bg-slate-950',
    success: 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900',
    warning: 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-900',
    danger: 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-900',
    info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-900',
  }
  return (
    <Card className={cn(tones[tone])}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
            <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
            {hint && <div className="text-xs text-slate-500 mt-1">{hint}</div>}
          </div>
          {Icon && (
            <div className="size-9 rounded-lg bg-white dark:bg-slate-900 border flex items-center justify-center shrink-0">
              <Icon className="size-4 text-slate-700 dark:text-slate-300" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Formatting helpers
export function formatCurrency(amount: number, currency = 'INR'): string {
  if (amount >= 100000) {
    return `${currency} ${(amount / 100000).toFixed(1)} L`
  }
  return `${currency} ${amount.toLocaleString('en-IN')}`
}

export function formatSalary(min?: number | null, max?: number | null, currency = 'INR'): string {
  if (min == null && max == null) return 'Not disclosed'
  if (min != null && max != null) return `${formatCurrency(min, currency)} – ${formatCurrency(max, currency)}`
  return formatCurrency((min ?? max)!, currency)
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
