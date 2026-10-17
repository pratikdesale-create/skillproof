'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useAppStore } from '@/store/app-store'
import { useAuthBootstrap } from '@/hooks/use-auth'
import { LandingPage } from '@/components/placement/landing/landing-page'
import { LoginPage } from '@/components/placement/landing/login-page'
import { RegisterPage } from '@/components/placement/landing/register-page'
import { StudentApp } from '@/components/placement/student/student-app'
import { OfficerApp } from '@/components/placement/officer/officer-app'
import { RecruiterApp } from '@/components/placement/recruiter/recruiter-app'
import { Skeleton } from '@/components/ui/skeleton'

function Router() {
  const route = useAppStore(s => s.route)
  // Public views
  if (route.view === 'landing') return <LandingPage />
  if (route.view === 'login') return <LoginPage />
  if (route.view === 'register') return <RegisterPage />

  // Role-specific apps handle their own internal routing
  if (route.view.startsWith('student/')) return <StudentApp />
  if (route.view.startsWith('officer/')) return <OfficerApp />
  if (route.view.startsWith('recruiter/')) return <RecruiterApp />

  // Fallback
  return <LandingPage />
}

export default function Home() {
  const [queryClient] = useState(() =>
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}

function AuthGate() {
  const meQuery = useAuthBootstrap()
  const user = useAppStore(s => s.user)
  const route = useAppStore(s => s.route)

  // While we don't know if the user is logged in, show a loading skeleton
  // — unless they're on a public view (landing/login/register).
  // The landing page is now the three-portal selection page and does NOT
  // require authentication — visitors can browse portals without logging in.
  const isPublicView = route.view === 'landing' || route.view === 'login' || route.view === 'register'

  if (meQuery.isLoading && !isPublicView && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="size-12 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xl mx-auto mb-4">
            S
          </div>
          <Skeleton className="h-4 w-32 mx-auto" />
          <p className="text-xs text-muted-foreground mt-2">Loading Skillproof…</p>
        </div>
      </div>
    )
  }

  return <Router />
}
