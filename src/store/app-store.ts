'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/types'

type Role = AuthUser['role']

// View state — what page is currently shown in the SPA.
// We use a simple string path with optional params encoded as ?id=...
// e.g. 'student/dashboard', 'student/jobs/abc123', 'officer/evidence'
export type ViewPath = string

export interface Route {
  view: string // e.g. 'student/dashboard' or 'landing' or 'login'
  params?: Record<string, string>
}

interface AppState {
  user: AuthUser | null
  profile: unknown | null
  setUser: (user: AuthUser | null) => void
  setProfile: (profile: unknown) => void
  logout: () => void

  route: Route
  navigate: (view: string, params?: Record<string, string>) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  notificationsOpen: boolean
  setNotificationsOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      profile: null,
      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      logout: () => set({ user: null, profile: null, route: { view: 'landing' } }),

      route: { view: 'landing' },
      navigate: (view, params) => set({ route: { view, params: params ?? {} }, sidebarOpen: false }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      notificationsOpen: false,
      setNotificationsOpen: (open) => set({ notificationsOpen: open }),
    }),
    {
      name: 'placement-hub-store',
      partialize: (s) => ({ route: s.route }),
    }
  )
)

// Helpers
export function roleHomeView(role: Role | undefined): string {
  switch (role) {
    case 'STUDENT': return 'student/dashboard'
    case 'OFFICER': return 'officer/dashboard'
    case 'RECRUITER': return 'recruiter/dashboard'
    case 'ADMIN': return 'officer/dashboard'
    default: return 'landing'
  }
}
