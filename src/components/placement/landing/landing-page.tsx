'use client'

import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ProgressRing } from '@/components/placement/shared/ui'
import { FitScoreBadge, StatusBadge } from '@/components/placement/shared/status-badge'
import { SkillTag } from '@/components/placement/shared/skill-tag'
import {
  ShieldCheck, FileText, Target, Users, BarChart3, GitBranch, Award, Scale, ArrowRight,
  CheckCircle2, Sparkles, TrendingUp, Briefcase, Bell, ChevronRight,
} from 'lucide-react'

export function LandingPage() {
  const navigate = useAppStore(s => s.navigate)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto w-full max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3 h-14">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
              PH
            </div>
            <span className="text-base font-semibold tracking-tight">Placement Hub</span>
            <Badge variant="secondary" className="ml-1 text-[10px] h-5">Demo</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => navigate('login')}>Sign in</Button>
            <Button size="sm" onClick={() => navigate('register')}>Get started</Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/[0.04] via-primary/[0.02] to-transparent" aria-hidden />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -z-10 size-[700px] rounded-full bg-primary/5 blur-3xl opacity-60" aria-hidden />
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-16 md:py-24 lg:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Copy */}
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground mb-5 shadow-sm">
                  <Sparkles className="size-3 text-primary" />
                  Evidence-based placements
                </div>
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] font-semibold tracking-tight text-foreground leading-[1.05]">
                  Prove your skills.
                  <br />
                  <span className="text-primary">Find your next opportunity.</span>
                </h1>
                <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl">
                  One intelligent placement platform to connect verified skills with relevant jobs, build evidence-backed resumes and track your career progress.
                </p>
                <div className="mt-7 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Button size="lg" onClick={() => navigate('login')} className="gap-2 w-full sm:w-auto">
                    Explore Opportunities <ArrowRight className="size-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('landing#how-it-works')} className="w-full sm:w-auto">
                    See How It Works
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Demo logins are clearly fake/synthetic. Sign in to explore the full product with seeded data.
                </p>
              </div>

              {/* Product preview */}
              <div className="relative">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

        {/* Stats band */}
        <section className="border-y bg-card/50">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
              <Stat label="Demo students" value="16" sub="seeded profiles" />
              <Stat label="Active jobs" value="10" sub="across 6 companies" />
              <Stat label="Skill catalog" value="34" sub="canonical + aliases" />
              <Stat label="Match results" value="160" sub="pre-computed" />
            </div>
          </div>
        </section>

        {/* Value propositions */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
                Three pillars of an honest placement process
              </h2>
              <p className="mt-2 text-muted-foreground">
                Every recommendation, score and resume bullet is traceable to supporting evidence — or explicitly marked as unverified.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ValueCard
                icon={<ShieldCheck className="size-5" />}
                eyebrow="Pillar 1"
                title="Verified Skills"
                description="Link each skill to assessments, projects, GitHub repositories, certifications or reviewer feedback. Reviewers approve, reject or request more evidence with an audit trail."
                points={[
                  'Assessments with scores',
                  'Project evidence with reviewer notes',
                  'GitHub repository metadata',
                  'Certifications from issuers',
                ]}
              />
              <ValueCard
                icon={<Target className="size-5" />}
                eyebrow="Pillar 2"
                title="Explainable Job Matching"
                description="A deterministic scoring engine compares job requirements to evidence-backed skills. Every score breaks down by skill, evidence and contribution."
                points={[
                  'Weighted required vs. preferred skills',
                  'Required-skill coverage flag',
                  'Missing-evidence analysis',
                  'Reproducible algorithm v1.0',
                ]}
              />
              <ValueCard
                icon={<FileText className="size-5" />}
                eyebrow="Pillar 3"
                title="Truthful Resume Building"
                description="Resume bullets link to the underlying evidence records. Unsupported claims are flagged or excluded — the AI can refine wording but cannot invent metrics or achievements."
                points={[
                  'Job-specific resume versions',
                  'Evidence-traceable bullets',
                  'Unsupported-claim flags',
                  'PDF + DOCX export',
                ]}
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-16 md:py-24 bg-muted/40 border-y">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">How it works</h2>
              <p className="mt-2 text-muted-foreground">A clear path from skill evidence to placement.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <Step
                num={1}
                title="Add skills & evidence"
                description="Students add skills and submit supporting evidence (assessments, projects, GitHub repos, certifications)."
                icon={<Users className="size-4" />}
              />
              <Step
                num={2}
                title="Officers review"
                description="Placement officers approve, reject or request more evidence. Verified skills feed the matching engine."
                icon={<ShieldCheck className="size-4" />}
              />
              <Step
                num={3}
                title="Match & rank"
                description="The scoring engine compares verified skills to job requirements and produces explainable fit scores."
                icon={<BarChart3 className="size-4" />}
              />
              <Step
                num={4}
                title="Apply with truthful resumes"
                description="Students generate evidence-linked resumes and track applications through the placement pipeline."
                icon={<FileText className="size-4" />}
              />
            </div>
          </div>
        </section>

        {/* Three roles */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Built for three roles</h2>
              <p className="mt-2 text-muted-foreground">Each role sees only what they should, with server-enforced authorization.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <RoleCard
                title="Student"
                accent="bg-emerald-500"
                items={[
                  'Submit supporting skill evidence',
                  'View job-fit scores and skill gaps',
                  'Generate evidence-backed resumes',
                  'Track applications and interviews',
                ]}
                onClick={() => navigate('login')}
                cta="Sign in as student"
              />
              <RoleCard
                title="Placement Officer"
                accent="bg-primary"
                items={[
                  'Review pending evidence queue',
                  'Manage jobs and CSV imports',
                  'Run batch ranking for any job',
                  'Oversee the placement pipeline',
                ]}
                onClick={() => navigate('login')}
                cta="Sign in as officer"
              />
              <RoleCard
                title="Recruiter"
                accent="bg-violet-500"
                items={[
                  'View jobs for your company',
                  'See ranked candidate shortlists',
                  'Inspect evidence summaries',
                  'Move candidates through stages',
                ]}
                onClick={() => navigate('login')}
                cta="Sign in as recruiter"
              />
            </div>
          </div>
        </section>

        {/* Differentiators */}
        <section className="py-16 md:py-20 bg-muted/30 border-y">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <h2 className="text-center text-2xl md:text-3xl font-semibold tracking-tight mb-10">What makes Placement Hub different</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-5">
              {[
                { icon: <Scale className="size-4 text-primary" />, title: 'Skill normalization engine', desc: 'ReactJS, React.js and React all map to the same canonical skill. Java and JavaScript stay distinct.' },
                { icon: <GitBranch className="size-4 text-primary" />, title: 'Multi-source job ingestion', desc: 'Manual postings, partner feeds, alumni referrals, CSV import. Duplicate detection across source ID, URL, title and description similarity.' },
                { icon: <Award className="size-4 text-primary" />, title: 'Server-enforced role authorization', desc: 'Frontend route guards are not enough. Every protected endpoint checks the user role and ownership on the server.' },
                { icon: <CheckCircle2 className="size-4 text-primary" />, title: 'Works without paid AI', desc: 'The deterministic resume generator and matching engine run end-to-end without any external AI API key.' },
                { icon: <TrendingUp className="size-4 text-primary" />, title: 'Audit trail for sensitive actions', desc: 'Evidence reviews, application status changes and duplicate merges are all recorded in an audit log.' },
                { icon: <Briefcase className="size-4 text-primary" />, title: 'Application pipeline with event history', desc: 'Applications flow APPLIED → UNDER_REVIEW → SHORTLISTED → INTERVIEW → OFFER with full event timeline.' },
              ].map(f => (
                <div key={f.title} className="flex items-start gap-3">
                  <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
            <div className="rounded-2xl border bg-primary text-primary-foreground p-8 md:p-12 text-center shadow-sm">
              <h2 className="text-2xl md:text-3xl font-semibold mb-3">
                Ready to explore the demo?
              </h2>
              <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-6">
                Sign in with one of the seeded demo accounts to explore the full platform with realistic data already loaded.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button size="lg" variant="secondary" onClick={() => navigate('login')} className="gap-2">
                  Sign in to the demo <ArrowRight className="size-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('register')} className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  Create an account
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            <div className="max-w-md">
              <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">PH</div>
                <span className="text-sm font-semibold">Placement Hub</span>
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
            © {new Date().getFullYear()} Placement Hub. Built as a hackathon demonstration. Not affiliated with the referenced platforms.
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================================
// LIVE PRODUCT PREVIEW (built from real app components)
// ============================================================

function ProductPreview() {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-primary/5 rounded-3xl blur-2xl" aria-hidden />
      <div className="relative rounded-2xl border bg-card shadow-xl overflow-hidden">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
          <div className="flex items-center gap-1.5">
            <div className="size-2.5 rounded-full bg-rose-400" />
            <div className="size-2.5 rounded-full bg-amber-400" />
            <div className="size-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">placement-hub / student / dashboard</div>
          <div className="flex items-center gap-1.5">
            <Bell className="size-3 text-muted-foreground" />
            <div className="size-5 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-semibold">AS</div>
          </div>
        </div>

        {/* Body: mini sidebar + content */}
        <div className="flex">
          <div className="hidden sm:flex w-32 flex-col gap-1 p-2 border-r bg-sidebar">
            {['Overview', 'Find Jobs', 'My Skills', 'Resume Studio', 'Applications'].map((label, i) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[10px] ${i === 0 ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-muted-foreground'}`}
              >
                <div className={`size-1 rounded-full ${i === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                {label}
              </div>
            ))}
          </div>
          <div className="flex-1 p-3 space-y-3">
            {/* Welcome line */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Welcome back, Aarav</div>
                <div className="text-[10px] text-muted-foreground">2 evidence items await your action.</div>
              </div>
              <ProgressRing value={100} size={44} label="Profile" />
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Verified skills" value="4" tone="verified" />
              <MiniStat label="Suitable jobs" value="5" tone="info" />
              <MiniStat label="Avg fit score" value="41.3%" tone="pending" />
            </div>

            {/* Top match */}
            <div className="rounded-lg border p-2.5 bg-card">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top match</div>
                <FitScoreBadge score={91.7} size="sm" />
              </div>
              <div className="text-xs font-medium">Mobile Engineer</div>
              <div className="text-[10px] text-muted-foreground">BrightPath Fintech · Mumbai · Hybrid</div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <SkillTag name="JavaScript" size="sm" />
                <SkillTag name="React" size="sm" />
                <SkillTag name="TypeScript" size="sm" isVerified />
              </div>
              <div className="mt-2">
                <div className="text-[9px] text-muted-foreground mb-0.5">Required-skill coverage</div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-[var(--verified)] rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>

            {/* Evidence status row */}
            <div className="rounded-lg border p-2.5 bg-card flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Evidence</div>
                <div className="text-xs font-medium mt-0.5">React project</div>
                <div className="text-[10px] text-muted-foreground">Submitted · GitHub</div>
              </div>
              <StatusBadge status="PENDING_REVIEW" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'verified' | 'pending' | 'info' }) {
  const tones = {
    verified: 'bg-[var(--verified-muted)] text-[var(--verified-foreground)]',
    pending: 'bg-[var(--pending-muted)] text-[var(--pending-foreground)]',
    info: 'bg-[var(--info-muted)] text-[var(--info-foreground)]',
  }
  return (
    <div className={`rounded-lg p-2 ${tones[tone]}`}>
      <div className="text-base font-bold tabular-nums leading-tight">{value}</div>
      <div className="text-[9px] opacity-80 leading-tight mt-0.5">{label}</div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-2xl md:text-3xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      <div className="text-[10px] text-muted-foreground/70">{sub}</div>
    </div>
  )
}

function ValueCard({
  icon, eyebrow, title, description, points,
}: { icon: React.ReactNode; eyebrow: string; title: string; description: string; points: string[] }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
          {icon}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{eyebrow}</div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
        <ul className="space-y-1.5 text-sm text-muted-foreground mt-auto">
          {points.map(p => (
            <li key={p} className="flex items-start gap-2">
              <CheckCircle2 className="size-4 mt-0.5 text-[var(--verified)] shrink-0" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function Step({
  num, title, description, icon,
}: { num: number; title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="relative rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="size-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
          {num}
        </div>
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>
    </div>
  )
}

function RoleCard({
  title, items, accent, onClick, cta,
}: { title: string; items: string[]; accent: string; onClick: () => void; cta: string }) {
  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className={`size-2 rounded-full ${accent} mb-1`} />
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <ul className="space-y-2 text-sm text-muted-foreground flex-1">
          {items.map(it => (
            <li key={it} className="flex items-start gap-2">
              <CheckCircle2 className="size-4 mt-0.5 text-[var(--verified)] shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="w-full" onClick={onClick}>
          {cta}
          <ChevronRight className="size-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  )
}
