'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiPatch, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, ErrorState,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Save, Lock, User, KeyRound, Eye, EyeOff, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AuthUser, Role } from '@/types'

interface AccountResponse {
  user: {
    id: string
    email: string
    name: string
    role: Role
    phone?: string | null
    avatarUrl?: string | null
  }
}

export function Settings() {
  const { data, isLoading, isError, error, refetch } = useQuery<AccountResponse>({
    queryKey: ['recruiter-settings'],
    queryFn: () => api<AccountResponse>('/api/settings'),
    staleTime: 30_000,
  })

  if (isLoading) return <SettingsSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load settings'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data?.user) {
    return <ErrorState message="Account not found" onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account information and security"
      />

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account"><User className="size-3.5 mr-1" /> Account</TabsTrigger>
          <TabsTrigger value="security"><KeyRound className="size-3.5 mr-1" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <AccountTab key={data.user.id} initialUser={data.user} />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ============== Account tab ==============

function AccountTab({ initialUser }: { initialUser: AuthUser }) {
  const qc = useQueryClient()
  const setUser = useAppStore(s => s.setUser)
  const [name, setName] = useState(initialUser.name ?? '')
  const [phone, setPhone] = useState(initialUser.phone ?? '')
  const [avatarUrl, setAvatarUrl] = useState(initialUser.avatarUrl ?? '')
  const [dirty, setDirty] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      apiPatch<{ user: AuthUser }>('/api/settings', body),
    onSuccess: (resp) => {
      toast.success('Account updated')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['recruiter-settings'] })
      qc.invalidateQueries({ queryKey: ['me'] })
      // Keep the app store in sync so the sidebar / header reflect changes immediately.
      if (resp.user) setUser(resp.user)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to update account')
    },
  })

  function handleSave() {
    const body: Record<string, unknown> = {}
    if (name.trim() && name !== initialUser.name) body.name = name.trim()
    if (phone !== (initialUser.phone ?? '')) body.phone = phone.trim() || null
    if (avatarUrl !== (initialUser.avatarUrl ?? '')) {
      body.avatarUrl = avatarUrl.trim() || null
    }
    if (Object.keys(body).length === 0) {
      toast.info('No changes to save')
      return
    }
    saveMutation.mutate(body)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account information</CardTitle>
        <CardDescription>Update your display name and contact details</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="acc-name">Full name</Label>
          <Input
            id="acc-name"
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true) }}
            placeholder="Your full name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="acc-email">Email</Label>
          <Input
            id="acc-email"
            value={initialUser.email ?? ''}
            disabled
            className="bg-muted/40"
          />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="size-3" /> Email cannot be changed; contact admin if needed.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="acc-phone">Phone</Label>
          <Input
            id="acc-phone"
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setDirty(true) }}
            placeholder="e.g. +91 98765 43210"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="acc-avatar">Avatar URL</Label>
          <Input
            id="acc-avatar"
            type="url"
            value={avatarUrl}
            onChange={(e) => { setAvatarUrl(e.target.value); setDirty(true) }}
            placeholder="https://example.com/avatar.png"
          />
          <p className="text-xs text-muted-foreground">
            Optional — used in the sidebar and notifications.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button onClick={handleSave} disabled={!dirty || saveMutation.isPending}>
            <Save className="size-4 mr-2" />
            {saveMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============== Security tab ==============

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: async (body: { currentPassword: string; newPassword: string }) =>
      apiPost('/api/settings', body),
    onSuccess: () => {
      toast.success('Password changed')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to change password')
    },
  })

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword
  const tooShort = newPassword.length > 0 && newPassword.length < 6
  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch && !changePasswordMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    changePasswordMutation.mutate({ currentPassword, newPassword })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Use a strong, unique password you don&apos;t reuse elsewhere</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="cur-pw">Current password</Label>
            <div className="relative">
              <Input
                id="cur-pw"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-pw">New password</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {tooShort && (
              <p className="text-xs text-[var(--danger-foreground)]">Password must be at least 6 characters.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="conf-pw">Confirm new password</Label>
            <div className="relative">
              <Input
                id="conf-pw"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-xs text-[var(--danger-foreground)]">Passwords do not match.</p>
            )}
            {confirmPassword.length > 0 && passwordsMatch && (
              <p className="text-xs text-[var(--verified-foreground)] flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Passwords match.
              </p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit}>
            <KeyRound className="size-4 mr-2" />
            {changePasswordMutation.isPending ? 'Changing…' : 'Change password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Loading…" />
      <CardSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
