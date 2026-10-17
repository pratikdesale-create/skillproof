'use client'

import { useAppStore, roleHomeView } from '@/store/app-store'
import { useLogin } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  GraduationCap, ShieldCheck, Briefcase, ArrowRight, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/types'

// ============================================================
// PORTAL CONFIGURATION
// ============================================================

interface Portal {
  num: string
  role: AuthUser['role']
  label: string
  heading: string
  description: string
  features: string[]
  // Accent colors per the spec: teal, blue, orange
  accentBg: string        // card background tint
  accentBorder: string    // top border accent
  accentIcon: string      // icon chip background
  accentText: string      // accent text color
  accentHover: string     // hover border
  icon: React.ComponentType<{ className?: string }>
  email: string
  password: string
  destView: string        // navigation destination after login
}

const PORTALS: Portal[] = [
  {
    num: '01',
    role: 'STUDENT',
    label: 'Student Portal',
    heading: 'Student Portal',
    description: 'Understand your skills, discover career gaps, build evidence of your abilities, and find opportunities that match your strengths.',
    features: ['Skill Intelligence', 'Verified Evidence', 'Career Readiness', 'Skill Gap Analysis'],
    // Teal accent
    accentBg: 'bg-teal-50/60 dark:bg-teal-950/20',
    accentBorder: 'border-top-emerald',
    accentIcon: 'bg-teal-500 text-white',
    accentText: 'text-teal-600 dark:text-teal-400',
    accentHover: 'hover:border-teal-300',
    icon: GraduationCap,
    email: 'aarav.sharma@demo.edu',
    password: 'demo1234',
    destView: 'student/dashboard',
  },
  {
    num: '02',
    role: 'OFFICER',
    label: 'Placement Officer Portal',
    heading: 'Placement Officer Portal',
    description: 'Monitor student readiness, identify placement opportunities, analyse skill gaps, and coordinate recruitment activities across your institution.',
    features: ['Student Analytics', 'Placement Tracking', 'Candidate Readiness', 'Placement Insights'],
    // Blue accent
    accentBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    accentBorder: 'border-top-blue',
    accentIcon: 'bg-blue-500 text-white',
    accentText: 'text-blue-600 dark:text-blue-400',
    accentHover: 'hover:border-blue-300',
    icon: ShieldCheck,
    email: 'officer@demo.edu',
    password: 'demo1234',
    destView: 'officer/dashboard',
  },
  {
    num: '03',
    role: 'RECRUITER',
    label: 'Recruiter Portal',
    heading: 'Recruiter Portal',
    description: 'Discover relevant candidates, compare evidence-backed skills against job requirements, and manage recruitment opportunities.',
    features: ['Talent Discovery', 'Skill Matching', 'Job Management', 'Candidate Evidence'],
    // Orange accent
    accentBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    accentBorder: 'border-top-amber',
    accentIcon: 'bg-orange-500 text-white',
    accentText: 'text-orange-600 dark:text-orange-400',
    accentHover: 'hover:border-orange-300',
    icon: Briefcase,
    email: 'recruiter@northwind.example',
    password: 'demo1234',
    destView: 'recruiter/dashboard',
  },
]

// ============================================================
// LANDING PAGE — three-portal selection
// ============================================================

export function LandingPage() {
  const navigate = useAppStore(s => s.navigate)
  const login = useLogin()

  const enterPortal = (portal: Portal) => {
    // Auto-login with demo credentials, then navigate to the role's dashboard.
    // Server-side authorization is preserved — the /api/auth/login endpoint
    // validates credentials and issues an HMAC-signed session cookie. All
    // protected API routes still call requireUser(req) + requireRole(...).
    login.mutate(
      { email: portal.email, password: portal.password },
      {
        onSuccess: (user) => {
          navigate(roleHomeView(user.role))
        },
      },
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ---- Top navigation ---- */}
      <header className="border-b bg-card/60 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
              S
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight">Skillproof</span>
              <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                Evidence-based skill intelligence
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('register')} className="text-muted-foreground">
            Create student account
          </Button>
        </div>
      </header>

      {/* ---- Hero + portals ---- */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 md:py-16">
        {/* Hero heading */}
        <div className="text-center max-w-3xl mb-10 md:mb-14 animate-fade-in-up">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
            One Platform. Three Portals.{' '}
            <span className="text-gradient-animated">Evidence-Based Opportunities.</span>
          </h1>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Connecting student skills, institutional readiness, and industry opportunities through evidence-based skill intelligence.
          </p>
        </div>

        {/* Portal cards */}
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {PORTALS.map((portal, i) => {
            const Icon = portal.icon
            return (
              <Card
                key={portal.role}
                className={cn(
                  'group relative flex flex-col overflow-hidden cursor-pointer transition-all duration-300',
                  'card-hover-lift animate-fade-in-up',
                  `animate-fade-in-up-delay-${i + 1}`,
                  portal.accentBg,
                  portal.accentBorder,
                  portal.accentHover,
                )}
                onClick={() => enterPortal(portal)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    enterPortal(portal)
                  }
                }}
              >
                {/* Large background number */}
                <div
                  className="absolute top-4 right-4 text-7xl md:text-8xl font-bold opacity-[0.06] select-none pointer-events-none"
                  aria-hidden
                >
                  {portal.num}
                </div>

                <CardContent className="p-6 md:p-8 flex flex-col gap-5 flex-1 relative z-10">
                  {/* Icon container */}
                  <div className={cn(
                    'size-14 rounded-2xl flex items-center justify-center shadow-sm',
                    portal.accentIcon,
                  )}>
                    <Icon className="size-7" />
                  </div>

                  {/* Heading */}
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                      {portal.heading}
                    </h2>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {portal.description}
                  </p>

                  {/* Feature tags */}
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {portal.features.map(tag => (
                      <span
                        key={tag}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                          portal.accentText,
                          'border-current/20 bg-card/60',
                        )}
                      >
                        <Check className="size-3" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Entry action */}
                  <div className={cn(
                    'flex items-center justify-between pt-4 border-t mt-2',
                    'text-sm font-semibold transition-colors',
                    portal.accentText,
                    'group-hover:gap-3',
                  )}>
                    <span>Enter {portal.label.replace(' Portal', '')} Portal</span>
                    <span className={cn(
                      'flex items-center justify-center size-8 rounded-full transition-transform',
                      portal.accentIcon,
                      'group-hover:translate-x-1',
                    )}>
                      <ArrowRight className="size-4 text-white" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Demo credentials note */}
        <p className="mt-8 text-xs text-muted-foreground text-center max-w-lg">
          Each portal signs you in with demo credentials and opens the role's dashboard.
          All data is clearly synthetic — for hackathon demonstration only.
        </p>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t bg-card py-4">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="size-5 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px]">S</div>
            <span className="font-medium text-foreground">Skillproof</span>
            <span>· Evidence-based skill intelligence for campus placements</span>
          </div>
          <div>Demo data — do not use for real recruitment</div>
        </div>
      </footer>
    </div>
  )
}
