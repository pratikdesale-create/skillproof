'use client'

import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ShieldCheck, FileText, Target, Users, BarChart3, GitBranch, Award, Scale, ArrowRight, CheckCircle2,
} from 'lucide-react'

export function LandingPage() {
  const navigate = useAppStore(s => s.navigate)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-background">
      {/* Hero */}
      <header className="border-b bg-white/80 backdrop-blur dark:bg-slate-950/80 sticky top-0 z-40">
        <div className="container mx-auto flex items-center justify-between py-4 px-6">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-400 flex items-center justify-center text-white dark:text-slate-900 font-bold">
              PH
            </div>
            <span className="text-xl font-semibold tracking-tight">Placement Hub</span>
            <Badge variant="secondary" className="ml-2">Demo</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('login')}>Sign in</Button>
            <Button onClick={() => navigate('register')}>Get started</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-12 md:py-20 max-w-6xl">
        {/* Hero */}
        <section className="text-center mb-20">
          <Badge variant="outline" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-200">
            Evidence-based placements
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-slate-50 mb-6">
            Every skill claim is
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent"> traceable to evidence</span>.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto mb-8">
            Placement Hub connects employer job requirements with students' actual demonstrated skills.
            Every match recommendation and every resume bullet is traceable to supporting evidence — or explicitly marked as unverified.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => navigate('login')} className="gap-2">
              Try the demo <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('register')}>
              Create an account
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Demo logins are clearly fake/synthetic. See the README for credentials.
          </p>
        </section>

        {/* Feature grid */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">Built for an honest placement process</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<ShieldCheck className="size-5" />}
              title="Evidence verification"
              description="Skills must be backed by assessments, projects, GitHub repos, certifications or reviewer feedback. Reviewers approve, reject, or request more evidence with an audit trail."
            />
            <FeatureCard
              icon={<Target className="size-5" />}
              title="Explainable job-fit scoring"
              description="A deterministic scoring engine compares job requirements to evidence-backed skills. Every score is broken down by skill, evidence and contribution."
            />
            <FeatureCard
              icon={<FileText className="size-5" />}
              title="Truthful resume generation"
              description="Resume bullets link to the underlying evidence records. Unsupported claims are flagged or excluded — the LLM cannot invent metrics, employment history or achievements."
            />
            <FeatureCard
              icon={<Scale className="size-5" />}
              title="Skill normalization"
              description="ReactJS, React.js and React all map to the same canonical skill. Java and JavaScript stay distinct. Deterministic alias dictionary with officer review."
            />
            <FeatureCard
              icon={<Users className="size-5" />}
              title="Batch-wide ranking"
              description="Officers can rank an entire eligible student batch for one job, with required-skill coverage, missing-skills column and CSV export."
            />
            <FeatureCard
              icon={<BarChart3 className="size-5" />}
              title="Application pipeline"
              description="Applications flow APPLIED → UNDER_REVIEW → SHORTLISTED → INTERVIEW → OFFER with event history, interviews, offers and audit events."
            />
            <FeatureCard
              icon={<GitBranch className="size-5" />}
              title="Multi-source job ingestion"
              description="Manual postings, partner feeds, alumni referrals, CSV import and an external API adapter. Duplicate detection across source ID, URL, title and description similarity."
            />
            <FeatureCard
              icon={<Award className="size-5" />}
              title="Three-role access control"
              description="Students, Placement Officers and Recruiters each see only what they should. Server-enforced authorization on every protected endpoint."
            />
            <FeatureCard
              icon={<CheckCircle2 className="size-5" />}
              title="Works without paid AI"
              description="A deterministic template-based resume generator and the matching engine run end-to-end without any external AI API key. The LLM is optional for refinement."
            />
          </div>
        </section>

        {/* Roles */}
        <section className="mb-20">
          <h2 className="text-2xl md:text-3xl font-semibold text-center mb-10">Three roles, one platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <RoleCard
              title="Student"
              accent="bg-emerald-500"
              items={[
                'Add skills and submit supporting evidence',
                'View job-fit scores and skill gaps',
                'Generate evidence-backed resumes',
                'Track applications, interviews and offers',
              ]}
              onClick={() => navigate('login')}
              cta="Sign in as student"
            />
            <RoleCard
              title="Placement Officer"
              accent="bg-indigo-500"
              items={[
                'Review pending evidence queue',
                'Manage job openings and CSV imports',
                'Run batch ranking for any job',
                'Oversee the application pipeline',
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
                'Move candidates through the pipeline',
              ]}
              onClick={() => navigate('login')}
              cta="Sign in as recruiter"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-50 dark:to-slate-200 p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-semibold text-white dark:text-slate-900 mb-3">
            Ready to explore the demo?
          </h2>
          <p className="text-slate-300 dark:text-slate-700 max-w-2xl mx-auto mb-6">
            Sign in with one of the seeded demo accounts to explore the full platform with realistic data already loaded.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate('login')} className="gap-2">
            Sign in to the demo <ArrowRight className="size-4" />
          </Button>
        </section>
      </main>

      <footer className="border-t bg-white dark:bg-slate-950 py-6">
        <div className="container mx-auto px-6 text-center text-sm text-slate-500">
          Placement Hub · Evidence-based campus placement platform · Demo build
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="size-10 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-2">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">{description}</CardDescription>
      </CardContent>
    </Card>
  )
}

function RoleCard({
  title, items, accent, onClick, cta,
}: { title: string; items: string[]; accent: string; onClick: () => void; cta: string }) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className={`size-2 rounded-full ${accent} mb-1`} />
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 flex-1">
          {items.map(it => (
            <li key={it} className="flex items-start gap-2">
              <CheckCircle2 className="size-4 mt-0.5 text-emerald-600 shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="w-full" onClick={onClick}>{cta}</Button>
      </CardContent>
    </Card>
  )
}
