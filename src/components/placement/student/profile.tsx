'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiPatch } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { PageHeader, CardSkeleton, ErrorState } from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Lock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { AuthUser, StudentProfile } from '@/types'

interface MeResponse {
  user: AuthUser | null
  profile: StudentProfile | null
}

// Form values: text inputs produce strings, but stored numeric fields
// may start as numbers from the API. We treat both as `string | number`.
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

export function Profile() {
  const user = useAppStore(s => s.user)
  const qc = useQueryClient()
  const { data, isLoading, isError, error, refetch } = useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/api/me'),
    staleTime: 30_000,
  })

  if (isLoading) return <ProfileSkeleton />
  if (isError) {
    return (
      <ErrorState
        message={(error as Error)?.message ?? 'Failed to load profile'}
        onRetry={() => refetch()}
      />
    )
  }
  if (!data?.profile) {
    return <ErrorState message="Student profile not found" />
  }

  return (
    <ProfileForm
      // Remount when the profile identity changes (e.g. after save) to reset
      // local form state from the freshly-fetched props.
      key={data.profile.id}
      user={user}
      initialProfile={data.profile}
      onSave={async (body) => {
        const resp = await apiPatch<{ profile: StudentProfile }>('/api/students/profile', body)
        // Refetch /api/me so navbar / dashboard see new completion %, etc.
        qc.invalidateQueries({ queryKey: ['me'] })
        qc.invalidateQueries({ queryKey: ['student-dashboard'] })
        return resp
      }}
    />
  )
}

function ProfileForm({
  user,
  initialProfile,
  onSave,
}: {
  user: AuthUser | null
  initialProfile: StudentProfile
  onSave: (body: Record<string, unknown>) => Promise<{ profile: StudentProfile }>
}) {
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
  const [saving, setSaving] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => onSave(body),
    onSuccess: () => {
      toast.success('Profile updated')
      setDirty(false)
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
    if (form.cgpa !== undefined && form.cgpa !== '' && form.cgpa !== null) {
      const v = typeof form.cgpa === 'string' ? parseFloat(form.cgpa) : form.cgpa
      if (!Number.isNaN(v)) body.cgpa = v
    }
    if (form.bio !== undefined) body.bio = form.bio
    if (form.location !== undefined) body.location = form.location
    if (form.linkedinUrl !== undefined) body.linkedinUrl = form.linkedinUrl
    if (form.githubUser !== undefined) body.githubUser = form.githubUser
    if (form.portfolioUrl !== undefined) body.portfolioUrl = form.portfolioUrl
    if (form.graduationYear !== undefined && form.graduationYear !== '' && form.graduationYear !== null) {
      const v = typeof form.graduationYear === 'string' ? parseInt(form.graduationYear, 10) : form.graduationYear
      if (!Number.isNaN(v)) body.graduationYear = v
    }
    setSaving(true)
    updateMutation.mutate(body, { onSettled: () => setSaving(false) })
  }

  const completion = initialProfile.profileCompletion ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Your academic background and contact details"
      >
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          <Save className="size-4 mr-2" />
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </PageHeader>

      {/* Profile completion progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Profile completion</span>
            <span className="text-2xl font-bold tabular-nums">{completion}%</span>
          </CardTitle>
          <CardDescription>
            {completion >= 90
              ? 'Excellent — your profile is complete'
              : completion >= 70
              ? 'Good progress — add more details to stand out'
              : 'Add details, skills, and evidence to boost your placement readiness'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={completion} className="h-2" />
        </CardContent>
      </Card>

      {/* Read-only name + form fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Your name and email are managed centrally</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                value={user?.name ?? ''}
                disabled
                className="bg-slate-50 dark:bg-slate-900"
              />
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Lock className="size-3" /> Name changes require admin support
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ''}
                disabled
                className="bg-slate-50 dark:bg-slate-900"
              />
            </div>
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
            <CardTitle className="text-base">About & links</CardTitle>
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
              <p className="text-xs text-slate-500">
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

      <div className="flex items-center gap-3 text-xs text-slate-500 border-t pt-4">
        <AlertCircle className="size-3.5" />
        Updating profile re-computes your profile completion score. Changes to skills and evidence live on their own page.
      </div>
    </div>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Your academic background and contact details" />
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}
