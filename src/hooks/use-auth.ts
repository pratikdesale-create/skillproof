'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiPost } from '@/lib/api-client'
import { useAppStore, roleHomeView } from '@/store/app-store'
import type { AuthUser, Notification } from '@/types'
import { toast } from 'sonner'

export function useAuthBootstrap() {
  const { user, setUser, setProfile, route, navigate } = useAppStore()
  const queryClient = useQueryClient()

  // 1. Fetch current user from /api/me on mount.
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api<{ user: AuthUser | null; profile: unknown }>('/api/me')
      return res
    },
    staleTime: 60_000,
    refetchOnMount: true,
  })

  useEffect(() => {
    if (meQuery.data) {
      setUser(meQuery.data.user)
      setProfile(meQuery.data.profile ?? null)
      // If logged in but route still says 'landing', navigate to role home.
      if (meQuery.data.user && route.view === 'landing') {
        navigate(roleHomeView(meQuery.data.user.role))
      }
      // If not logged in but route is something else, send to landing.
      if (!meQuery.data.user && route.view !== 'landing' && route.view !== 'login' && route.view !== 'register') {
        navigate('landing')
      }
    }
    // Bootstrap effect: sync store + route on /api/me result.
    // We intentionally only re-run on meQuery.data identity change.
  }, [meQuery.data])

  return meQuery
}

export function useLogin() {
  const qc = useQueryClient()
  const navigate = useAppStore(s => s.navigate)
  const setUser = useAppStore(s => s.setUser)
  const setProfile = useAppStore(s => s.setProfile)

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) =>
      apiPost<AuthUser>('/api/auth/login', { email, password }),
    onSuccess: (user) => {
      setUser(user)
      // Refetch /api/me to get the profile too.
      qc.invalidateQueries({ queryKey: ['me'] })
      navigate(roleHomeView(user.role))
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Login failed')
    },
  })
}

export function useRegister() {
  const qc = useQueryClient()
  const navigate = useAppStore(s => s.navigate)
  const setUser = useAppStore(s => s.setUser)

  // SECURITY: public registration is STUDENT-only. The `role` field is
  // accepted but the server forces it to STUDENT. See
  // src/app/api/auth/register/route.ts (P0-A security fix).
  return useMutation({
    mutationFn: async (body: {
      name: string
      email: string
      password: string
      role?: 'STUDENT' // accepted for backward compat; server forces STUDENT
      university?: string
      batch?: string
      branch?: string
    }) => apiPost<AuthUser>('/api/auth/register', body),
    onSuccess: (user) => {
      setUser(user)
      qc.invalidateQueries({ queryKey: ['me'] })
      navigate(roleHomeView(user.role))
      toast.success(`Welcome to Skillproof, ${user.name.split(' ')[0]}!`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Registration failed')
    },
  })
}

export function useLogout() {
  const qc = useQueryClient()
  const logout = useAppStore(s => s.logout)
  return useMutation({
    mutationFn: async () => apiPost('/api/auth/logout'),
    onSuccess: () => {
      logout()
      qc.clear()
      toast.success('Signed out')
    },
  })
}

export function useNotifications() {
  const user = useAppStore(s => s.user)
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => api<Notification[]>('/api/notifications'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: !!user,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => apiPost(`/api/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => apiPost('/api/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
