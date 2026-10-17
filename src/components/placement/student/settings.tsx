'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiPatch, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, ErrorState, ProgressRing,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Save, Lock, AlertCircle, User, Shield, KeyRound, Eye, EyeOff, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { AuthUser, StudentProfile } from '@/types'

interface MeResponse {
  user: AuthUser | null
  profile: (StudentProfile & { id: string }) | null
}

export function Settings() {
  const { data, isLoading, isError, error, refetch } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/me'),
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
        description="Manage your account, profile, and security preferences"
      />

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account"><User className="size-3.5 mr-1" /> Account</TabsTrigger>
          <TabsTrigger value="profile"><Shield className="size-3.5 mr-1" /> Profile</TabsTrigger>
          <TabsTrigger value="security"><KeyRound className="size-3.5 mr-1" /> Security</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="mt-4">
          <AccountTab
            key={data.user.id}
            initialUser={data.user}
          />
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          {data.profile ? (
            <ProfileTab
              key={data.profile.id}
              initialProfile={data.profile}
            />
          ) : (
            <ErrorState message="Student profile not found" />
          )}
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
      qc.invalidateQueries({ queryKey: ['me'] })
      // Update the app store's user too so the sidebar / header reflect changes immediately.
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
    if (avatarUrl !== (initialUser.avatarUrl ?? '')) body.avatarUrl = avatarUrl.trim() || null
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

// ============== Profile tab ==============

type ProfileFormValues = {
  university: string
  batch: string
  branch: string
  cgpa: string | number
  bio: string
  location: string
  linkedinUrl: string
  githubUser: string
  portfolioUrl: string
  graduationYear: string | number
}

function ProfileTab({ initialProfile }: { initialProfile: StudentProfile & { id: string } }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<ProfileFormValues>({
    university: initialProfile.university ?? '',
    batch: initialProfile.batch ?? '',
    branch: initialProfile.branch ?? '',
    cgpa: initialProfile.cgpa ?? '',
    bio: initialProfile.bio ?? '',
    location: initialProfile.location ?? '',
    linkedinUrl: initialProfile.linkedinUrl ?? '',
    githubUser: initialProfile.githubUser ?? '',
    portfolioUrl: initialProfile.portfolioUrl ?? '',
    graduationYear: initialProfile.graduationYear ?? '',
  })
  const [dirty, setDirty] = useState(false)

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) =>
      apiPatch<{ profile: StudentProfile }>('/api/students/profile', body),
    onSuccess: () => {
      toast.success('Profile updated')
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['me'] })
      qc.invalidateQueries({ queryKey: ['student-dashboard'] })
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to update profile')
    },
  })

  function setField<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  function handleSave() {
    const body: Record<string, unknown> = {}
    if (form.university !== undefined) body.university = form.university
    if (form.batch !== undefined) body.batch = form.batch
    if (form.branch !== undefined) body.branch = form.branch
    if (form.cgpa !== '' && form.cgpa != null) {
      const v = typeof form.cgpa === 'string' ? parseFloat(form.cgpa) : form.cgpa
      if (!Number.isNaN(v)) body.cgpa = v
    }
    if (form.bio !== undefined) body.bio = form.bio
    if (form.location !== undefined) body.location = form.location
    if (form.linkedinUrl !== undefined) body.linkedinUrl = form.linkedinUrl
    if (form.githubUser !== undefined) body.githubUser = form.githubUser
    if (form.portfolioUrl !== undefined) body.portfolioUrl = form.portfolioUrl
    if (form.graduationYear !== '' && form.graduationYear != null) {
      const v = typeof form.graduationYear === 'string' ? parseInt(form.graduationYear, 10) : form.graduationYear
      if (!Number.isNaN(v)) body.graduationYear = v
    }
    updateMutation.mutate(body)
  }

  const completion = initialProfile.profileCompletion ?? 0

  return (
    <div className="space-y-6">
      {/* Profile completion ProgressRing */}
      <Card>
        <CardContent className="p-6 flex items-center gap-6">
          <ProgressRing value={completion} size={80} strokeWidth={8} label="complete" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">Profile completion</div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {completion >= 90
                ? 'Excellent — your profile is complete and ready for recruiters.'
                : completion >= 70
                ? 'Good progress — add more details to stand out.'
                : 'Add details, skills, and evidence to boost your placement readiness.'}
            </p>
          </div>
          <Button onClick={handleSave} disabled={!dirty || updateMutation.isPending}>
            <Save className="size-4 mr-2" />
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Academic background</CardTitle>
            <CardDescription>Your university, branch, and graduation details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="university">University</Label>
              <Input
                id="university"
                value={(form.university as string) ?? ''}
                onChange={(e) => setField('university', e.target.value)}
                placeholder="e.g. Indian Institute of Technology, Madras"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="batch">Batch</Label>
                <Input
                  id="batch"
                  value={(form.batch as string) ?? ''}
                  onChange={(e) => setField('batch', e.target.value)}
                  placeholder="e.g. 2025"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="graduationYear">Graduation year</Label>
                <Input
                  id="graduationYear"
                  type="number"
                  value={(form.graduationYear as string | number) ?? ''}
                  onChange={(e) => setField('graduationYear', e.target.value)}
                  placeholder="2025"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="branch">Branch</Label>
                <Input
                  id="branch"
                  value={(form.branch as string) ?? ''}
                  onChange={(e) => setField('branch', e.target.value)}
                  placeholder="Computer Science"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cgpa">CGPA</Label>
                <Input
                  id="cgpa"
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={(form.cgpa as string | number) ?? ''}
                  onChange={(e) => setField('cgpa', e.target.value)}
                  placeholder="8.5"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">About &amp; links</CardTitle>
            <CardDescription>Bio and portfolio links for recruiters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={5}
                value={(form.bio as string) ?? ''}
                onChange={(e) => setField('bio', e.target.value)}
                placeholder="A short professional summary — your strengths, interests, and career goals."
                maxLength={2000}
              />
              <p className="text-xs text-muted-foreground">
                {((form.bio as string) ?? '').length}/2000
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={(form.location as string) ?? ''}
                onChange={(e) => setField('location', e.target.value)}
                placeholder="e.g. Bengaluru, India"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin">LinkedIn URL</Label>
              <Input
                id="linkedin"
                type="url"
                value={(form.linkedinUrl as string) ?? ''}
                onChange={(e) => setField('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/yourname"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="github">GitHub username</Label>
                <Input
                  id="github"
                  value={(form.githubUser as string) ?? ''}
                  onChange={(e) => setField('githubUser', e.target.value)}
                  placeholder="yourname"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portfolio">Portfolio URL</Label>
                <Input
                  id="portfolio"
                  type="url"
                  value={(form.portfolioUrl as string) ?? ''}
                  onChange={(e) => setField('portfolioUrl', e.target.value)}
                  placeholder="https://yourname.dev"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-4">
        <AlertCircle className="size-3.5" />
        Updating profile re-computes your profile completion score. Changes to skills and evidence live on their own page.
      </div>
    </div>
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
