'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import {
  PageHeader, CardSkeleton, EmptyState, ErrorState, formatDate,
} from '@/components/placement/shared/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  FileText, Plus, ArrowRight, Sparkles, Briefcase, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

interface ResumeListItem {
  id: string
  jobId?: string | null
  jobTitle?: string | null
  version: number
  title: string
  isGenerated: boolean
  summary?: string | null
  bulletCount: number
  pdfPath?: string | null
  docxPath?: string | null
  createdAt: string
  updatedAt: string
}
interface ResumesResponse { data: ResumeListItem[] }

interface JobListItem {
  id: string
  title: string
  company: { id: string; name: string }
}
interface JobsResponse { data: JobListItem[] }

export function Resumes() {
  const navigate = useAppStore(s => s.navigate)
  const qc = useQueryClient()

  const [generateOpen, setGenerateOpen] = useState(false)
  const [jobId, setJobId] = useState<string>('')

  const resumesQuery = useQuery<ResumesResponse>({
    queryKey: ['resumes'],
    queryFn: () => apiGet<ResumesResponse>('/api/resumes'),
    staleTime: 30_000,
  })

  // For the dialog job picker — list open jobs the student can target
  const jobsQuery = useQuery<JobsResponse>({
    queryKey: ['student-jobs-for-resume'],
    queryFn: () => apiGet<JobsResponse>('/api/jobs?status=OPEN&take=50'),
    enabled: generateOpen,
    staleTime: 60_000,
  })

  const generateMutation = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/resumes/generate', jobId ? { jobId } : {}),
    onSuccess: (resp) => {
      toast.success('Resume generated')
      setGenerateOpen(false)
      qc.invalidateQueries({ queryKey: ['resumes'] })
      if (resp?.id) navigate(`student/resumes/${resp.id}`)
    },
    onError: (err: unknown) => {
      const e = err as { message?: string }
      toast.error(e.message ?? 'Failed to generate resume')
    },
  })

  if (resumesQuery.isLoading) return <ResumesSkeleton />
  if (resumesQuery.isError) {
    return (
      <ErrorState
        message={(resumesQuery.error as Error)?.message ?? 'Failed to load resumes'}
        onRetry={() => resumesQuery.refetch()}
      />
    )
  }

  const resumes = resumesQuery.data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resume Studio"
        description="Build evidence-backed resumes tailored to each role"
      >
        <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" /> Generate new resume
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Generate resume</DialogTitle>
              <DialogDescription>
                We&apos;ll pull your verified skills, projects, and assessments to build a tailored resume.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="r-job">Target job (optional)</Label>
                <Select value={jobId} onValueChange={setJobId}>
                  <SelectTrigger id="r-job" className="w-full">
                    <SelectValue placeholder="General resume — no specific job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">General resume — no specific job</SelectItem>
                    {jobsQuery.data?.data.map(j => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title} · {j.company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {jobsQuery.isLoading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="size-3 animate-spin" /> Loading jobs…
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  A targeted resume highlights skills required by the chosen role.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="size-4 mr-2" /> Generate</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {resumes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={FileText}
              title="No resumes yet"
              description="Generate your first evidence-backed resume — we'll assemble verified skills, projects, and certifications into a clean one-page PDF."
              action={
                <Button size="sm" onClick={() => setGenerateOpen(true)}>
                  <Plus className="size-4 mr-2" /> Generate resume
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((r) => (
            <Card
              key={r.id}
              className="hover:shadow-md transition-shadow cursor-pointer flex flex-col"
              onClick={() => navigate(`student/resumes/${r.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{r.title}</CardTitle>
                    {r.jobTitle ? (
                      <CardDescription className="flex items-center gap-1 mt-0.5">
                        <Briefcase className="size-3" /> {r.jobTitle}
                      </CardDescription>
                    ) : (
                      <CardDescription className="mt-0.5">General resume</CardDescription>
                    )}
                  </div>
                  {r.isGenerated && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <Sparkles className="size-3 mr-1" /> Auto
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {r.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-3 mb-3">
                    {r.summary}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
                  <span>v{r.version} · {r.bulletCount} bullets</span>
                  <span>{formatDate(r.createdAt)}</span>
                </div>
                <Button size="sm" variant="ghost" className="mt-2 self-end">
                  Open <ArrowRight className="size-3 ml-1" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ResumesSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader title="Resume Studio" description="Loading…" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => <CardSkeleton key={i} />)}
      </div>
    </div>
  )
}
