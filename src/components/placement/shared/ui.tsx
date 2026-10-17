'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ============================================================
// LAYOUT PRIMITIVES
// ============================================================

export function PageHeader({
  title, description, children, breadcrumbs,
}: {
  title: string
  description?: string
  children?: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
}) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {b.href ? (
                  <button
                    onClick={() => { /* SPA navigation handled by parent */ }}
                    className="hover:text-foreground transition-colors"
                  >
                    {b.label}
                  </button>
                ) : (
                  <span className="text-foreground">{b.label}</span>
                )}
                {i < breadcrumbs.length - 1 && <span className="text-muted-foreground/60">/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
      </div>
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
  className,
  illustration,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  illustration?: 'default' | 'empty-list' | 'no-results' | 'success'
}) {
  // Subtle SVG background patterns for visual interest without being decorative
  const patterns: Record<string, React.ReactNode> = {
    'default': (
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
        <defs>
          <pattern id="dots-default" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-default)" />
      </svg>
    ),
    'empty-list': (
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden>
        <defs>
          <pattern id="lines-empty" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M0 10 L20 10" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#lines-empty)" />
      </svg>
    ),
    'no-results': (
      <svg className="absolute inset-0 w-full h-full opacity-[0.04]" aria-hidden>
        <defs>
          <pattern id="grid-no-results" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M0 0 L16 0 L16 16" stroke="currentColor" strokeWidth="0.5" fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-no-results)" />
      </svg>
    ),
    'success': (
      <svg className="absolute inset-0 w-full h-full opacity-[0.05]" aria-hidden>
        <defs>
          <pattern id="dots-success" width="12" height="12" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots-success)" />
      </svg>
    ),
  }
  return (
    <div className={cn('relative flex flex-col items-center justify-center py-12 px-4 text-center overflow-hidden', className)}>
      {patterns[illustration ?? 'default']}
      <div className="relative z-10 flex flex-col items-center">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4 ring-1 ring-border">
          <Icon className="size-5 text-muted-foreground" />
        </div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="size-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 ring-1 ring-destructive/20">
        <span className="text-destructive font-bold" aria-hidden>!</span>
      </div>
      <h3 className="text-base font-medium text-foreground">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// ============================================================
// STAT CARD
// ============================================================

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  emphasis = false,
  onClick,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: LucideIcon
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brand'
  emphasis?: boolean
  onClick?: () => void
  className?: string
}) {
  const tones: Record<string, string> = {
    default: 'bg-card',
    success: 'bg-[var(--verified-muted)] border-[var(--verified)]/30',
    warning: 'bg-[var(--pending-muted)] border-[var(--pending)]/30',
    danger: 'bg-[var(--danger-muted)] border-[var(--danger)]/30',
    info: 'bg-[var(--info-muted)] border-[var(--info)]/30',
    brand: 'bg-primary text-primary-foreground border-primary',
  }
  const iconTones: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-[var(--verified-foreground)]',
    warning: 'text-[var(--pending-foreground)]',
    danger: 'text-[var(--danger-foreground)]',
    info: 'text-[var(--info-foreground)]',
    brand: 'text-primary-foreground',
  }
  const isBrand = tone === 'brand'
  return (
    <Card
      className={cn(
        'transition-all',
        onClick && 'card-hover-lift cursor-pointer',
        emphasis && 'ring-1 ring-primary/30 shadow-soft',
        tones[tone],
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className={cn('text-xs uppercase tracking-wider font-medium', isBrand ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{label}</div>
            <div className={cn('text-2xl font-bold tabular-nums mt-1', isBrand ? 'text-primary-foreground' : 'text-foreground')}>{value}</div>
            {hint && <div className={cn('text-xs mt-1.5', isBrand ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{hint}</div>}
          </div>
          {Icon && (
            <div className={cn(
              'size-9 rounded-lg flex items-center justify-center shrink-0',
              isBrand ? 'bg-primary-foreground/10' : 'bg-muted'
            )}>
              <Icon className={cn('size-4', iconTones[tone])} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// SECTION HEADER (for grouping content within a page)
// ============================================================

export function SectionHeader({
  title, description, action, className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ============================================================
// PROGRESS / COMPLETION
// ============================================================

export function ProgressRing({
  value, size = 48, strokeWidth = 4, label,
}: {
  value: number // 0..100
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (Math.max(0, Math.min(100, value)) / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--muted)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--primary)" strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-semibold tabular-nums">{Math.round(value)}%</span>
        {label && <span className="text-[9px] text-muted-foreground leading-tight mt-0.5">{label}</span>}
      </div>
    </div>
  )
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

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

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return '—'
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diff = then - now
  const abs = Math.abs(diff)
  const minute = 60_000, hour = 60 * minute, day = 24 * hour, week = 7 * day
  const fmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < hour) return fmt.format(Math.round(diff / minute), 'minute')
  if (abs < day) return fmt.format(Math.round(diff / hour), 'hour')
  if (abs < week) return fmt.format(Math.round(diff / day), 'day')
  return fmt.format(Math.round(diff / week), 'week')
}

// ============================================================
// APP FOOTER (shared across landing + auth + app)
// ============================================================

export function AppFooter({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  if (variant === 'minimal') {
    return (
      <footer className="border-t bg-card py-3">
        <div className="container mx-auto px-6 text-center text-xs text-muted-foreground">
          Skillproof · Evidence-based placements · Algorithm v1.0 ·{' '}
          <span className="text-[var(--pending-foreground)]">Demo data — do not use for real recruitment</span>
        </div>
      </footer>
    )
  }
  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="max-w-md">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
                PH
              </div>
              <span className="text-sm font-semibold">Skillproof</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              One intelligent placement platform to connect verified skills with relevant jobs, build evidence-backed resumes and track your career progress.
            </p>
          </div>
          <div className="text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground mb-1">Status</div>
            <div>Algorithm v1.0</div>
            <div>Demo data — do not use for real recruitment</div>
          </div>
        </div>
        <div className="border-t mt-6 pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Skillproof. Built as a hackathon demonstration.
        </div>
      </div>
    </footer>
  )
}

export { Link }
