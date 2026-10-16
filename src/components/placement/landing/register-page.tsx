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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ArrowLeft } from 'lucide-react'

export function RegisterPage() {
  const navigate = useAppStore(s => s.navigate)
  const register = useRegister()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'STUDENT' | 'OFFICER' | 'RECRUITER'>('STUDENT')
  const [university, setUniversity] = useState('')
  const [batch, setBatch] = useState('')
  const [branch, setBranch] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password) return
    register.mutate({
      name, email, password, role,
      ...(role === 'STUDENT' ? { university, batch, branch } : {}),
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="border-b bg-white dark:bg-slate-950">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => navigate('landing')}>
            <div className="size-8 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center justify-center font-bold text-sm">
              PH
            </div>
            <span className="text-lg font-semibold">Placement Hub</span>
          </button>
          <Button variant="ghost" size="sm" onClick={() => navigate('landing')}>
            <ArrowLeft className="size-4 mr-1" /> Back
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Register as a student, placement officer or recruiter.</CardDescription>
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
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v: 'STUDENT' | 'OFFICER' | 'RECRUITER') => setRole(v)}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="OFFICER">Placement Officer</SelectItem>
                    <SelectItem value="RECRUITER">Recruiter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {role === 'STUDENT' && (
                <div className="space-y-4 rounded-md border bg-slate-50 dark:bg-slate-900/50 p-4">
                  <p className="text-xs font-medium text-slate-500 uppercase">Student details (optional)</p>
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
              )}
              {role === 'RECRUITER' && (
                <p className="text-xs text-slate-500">
                  After registration, an officer can associate your recruiter profile with a company.
                </p>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-3 mt-4">
              <Button type="submit" className="w-full" disabled={register.isPending}>
                {register.isPending ? 'Creating account…' : 'Create account'}
              </Button>
              <p className="text-sm text-slate-500 text-center">
                Already have an account?{' '}
                <button type="button" className="text-slate-900 dark:text-slate-100 underline" onClick={() => navigate('login')}>
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
