'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { useLogin } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'

const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'aarav.sharma@demo.edu', password: 'demo1234' },
  { label: 'Officer', email: 'officer@demo.edu', password: 'demo1234' },
  { label: 'Recruiter', email: 'recruiter@northwind.example', password: 'demo1234' },
  { label: 'Admin', email: 'admin@demo.edu', password: 'demo1234' },
]

export function LoginPage() {
  const navigate = useAppStore(s => s.navigate)
  const login = useLogin()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter your email and password')
      return
    }
    login.mutate({ email, password })
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
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="hidden md:flex flex-col justify-center">
            <h1 className="text-3xl font-bold mb-3">Welcome back</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Sign in to continue to your Placement Hub dashboard. Your role determines what you can see and do.
            </p>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Demo accounts (clearly fake):</p>
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.email}
                  className="w-full text-left p-3 rounded-lg border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => { setEmail(acc.email); setPassword(acc.password) }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{acc.label}</div>
                      <div className="text-xs text-slate-500 font-mono">{acc.email}</div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">demo1234</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Use one of the demo accounts above or your own.</CardDescription>
            </CardHeader>
            <form onSubmit={submit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 mt-4">
                <Button type="submit" className="w-full" disabled={login.isPending}>
                  {login.isPending ? 'Signing in…' : 'Sign in'}
                </Button>
                <p className="text-sm text-slate-500 text-center">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="text-slate-900 dark:text-slate-100 underline" onClick={() => navigate('register')}>
                    Register
                  </button>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
