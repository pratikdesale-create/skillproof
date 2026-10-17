'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { useRegister } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter,
} from '@/components/ui/card'
import { ArrowLeft, GraduationCap } from 'lucide-react'

/**
 * Public registration page.
 *
 * SECURITY: Public registration is restricted to STUDENT accounts. The
 * OFFICER / RECRUITER / ADMIN roles are provisioned through a trusted
 * administrative workflow (seed script + future admin-invite flow), not
 * through this public form.
 *
 * The role selector was removed from the UI to match the server-side
 * restriction in src/app/api/auth/register/route.ts (P0-A security fix).
 */
export function RegisterPage() {
  const navigate = useAppStore(s => s.navigate)
  const register = useRegister()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [university, setUniversity] = useState('')
  const [batch, setBatch] = useState('')
  const [branch, setBranch] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    // role is intentionally NOT sent — server forces STUDENT for public registration.
    register.mutate({
      name, email, password,
      role: 'STUDENT',
      university, batch, branch,
    })
  }

  return (
    <div className="min-h-screen bg-background flex flex-col career-auth-bg">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => navigate('landing')}>
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              S
            </div>
            <span className="text-lg font-semibold">Skillproof</span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate('landing')}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1.5">
              <GraduationCap className="size-4 text-primary" />
              <span className="text-xs uppercase tracking-wider font-semibold text-primary">Student account</span>
            </div>
            <CardTitle>Create your student account</CardTitle>
            <CardDescription>
              Public registration is for students. Placement officers and recruiters are provisioned by an administrator.
            </CardDescription>
          </CardHeader>
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <div className="space-y-4 rounded-md border bg-muted/40 p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Student details (optional)</p>
                <div className="space-y-2">
                  <Label htmlFor="university">University</Label>
                  <Input id="university" value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="e.g. National Institute of Technology" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch</Label>
                    <Input id="batch" value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="2022-2026" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input id="branch" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Computer Science" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 mt-4">
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? 'Creating account…' : 'Create student account'}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{' '}
                <button type="button" className="text-foreground underline" onClick={() => navigate('login')}>
                  Sign in
                </button>
              </p>
            </CardFooter>
          </form>
        </Card>
      </main>
    </div>
  )
}
