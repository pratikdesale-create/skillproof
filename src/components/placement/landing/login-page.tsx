'use client'

import { useAppStore } from '@/store/app-store'
import { useLogin } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowLeft, GraduationCap, ShieldCheck, Briefcase, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Portal {
  role: 'STUDENT' | 'OFFICER' | 'RECRUITER'
  label: string
  email: string
  password: string
  icon: React.ComponentType<{ className?: string }>
  gradient: string
  iconChip: string
  topBorder: string
  features: string[]
}

const PORTALS: Portal[] = [
  {
    role: 'STUDENT',
    label: 'Student Portal',
    email: 'aarav.sharma@demo.edu',
    password: 'demo1234',
    icon: GraduationCap,
    gradient: 'gradient-emerald-subtle',
    iconChip: 'icon-chip-emerald',
    topBorder: 'border-top-emerald',
    features: [
      'Add skills and submit supporting evidence',
      'View job-fit scores and skill gaps',
      'Generate evidence-backed resumes',
      'Track applications and interviews',
    ],
  },
  {
    role: 'OFFICER',
    label: 'Placement Officer Portal',
    email: 'officer@demo.edu',
    password: 'demo1234',
    icon: ShieldCheck,
    gradient: 'gradient-blue-subtle',
    iconChip: 'icon-chip-blue',
    topBorder: 'border-top-blue',
    features: [
      'Review pending evidence queue',
      'Manage jobs and CSV imports',
      'Run batch ranking for any job',
      'Oversee the placement pipeline',
    ],
  },
  {
    role: 'RECRUITER',
    label: 'Recruiter Portal',
    email: 'recruiter@northwind.example',
    password: 'demo1234',
    icon: Briefcase,
    gradient: 'gradient-violet-subtle',
    iconChip: 'icon-chip-violet',
    topBorder: 'border-top-violet',
    features: [
      'View jobs for your company',
      'See ranked candidate shortlists',
      'Inspect evidence summaries',
      'Move candidates through stages',
    ],
  },
]

/**
 * Portal selection page — replaces the old login form.
 *
 * Users pick one of three portals (Student / Officer / Recruiter).
 * Each portal auto-logs in with the corresponding demo credentials and
 * navigates to that role's dashboard.
 *
 * Demo credentials are clearly fake/synthetic — this is a hackathon demo.
 */
export function LoginPage() {
  const navigate = useAppStore(s => s.navigate)
  const login = useLogin()

  const enterPortal = (portal: Portal) => {
    login.mutate({ email: portal.email, password: portal.password })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col career-auth-bg">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <button className="flex items-center gap-2.5" onClick={() => navigate('landing')}>
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
              S
            </div>
            <span className="text-lg font-semibold">Skillproof</span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate('landing')}>
            <ArrowLeft className="size-4 mr-1" /> Back to home
          </Button>
        </div>
      </header>

      {/* Portals */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl">
          {/* Heading */}
          <div className="text-center mb-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-4 shadow-sm">
              <span className="size-2 rounded-full bg-[var(--verified)]"></span>
              <span className="size-2 rounded-full bg-[var(--info)]"></span>
              <span className="size-2 rounded-full bg-violet-500"></span>
              Choose your portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Select a portal to explore
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
              Each portal signs you in with demo credentials and takes you to that role's dashboard. All data is clearly synthetic.
            </p>
          </div>

          {/* Portal cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PORTALS.map((portal, i) => {
              const Icon = portal.icon
              return (
                <Card
                  key={portal.role}
                  className={cn(
                    'h-full flex flex-col overflow-hidden card-hover-lift animate-fade-in-up',
                    `animate-fade-in-up-delay-${i + 1}`,
                    portal.gradient,
                    portal.topBorder,
                  )}
                >
                  <CardHeader>
                    <div className={cn('size-12 rounded-xl flex items-center justify-center mb-3 shadow-sm', portal.iconChip)}>
                      <Icon className="size-6" />
                    </div>
                    <CardTitle className="text-lg">{portal.label}</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      {portal.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4">
                    <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                      {portal.features.map(f => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="size-4 mt-0.5 text-[var(--verified)] shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full gap-2"
                      onClick={() => enterPortal(portal)}
                      disabled={login.isPending}
                    >
                      {login.isPending ? 'Signing in…' : `Enter ${portal.label.replace(' Portal', '')}`}
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Admin note */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Admin access: <span className="font-mono">admin@demo.edu</span> / <span className="font-mono">demo1234</span> — sign in via the officer portal, then switch role in the profile dropdown.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
