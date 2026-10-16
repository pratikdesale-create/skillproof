// Shared TypeScript types for Placement Hub frontend.
// Mirrors the Prisma models + API response shapes.

export type Role = 'STUDENT' | 'OFFICER' | 'RECRUITER' | 'ADMIN'
export type EvidenceStatus = 'UNVERIFIED' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'NEEDS_MORE_EVIDENCE'
export type ApplicationStatus = 'APPLIED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'ASSESSMENT' | 'INTERVIEW' | 'OFFER' | 'REJECTED' | 'WITHDRAWN'
export type JobStatus = 'OPEN' | 'CLOSED' | 'DRAFT' | 'ARCHIVED'
export type JobSourceType = 'MANUAL' | 'FEED' | 'ALUMNI' | 'API' | 'CSV'
export type ClaimStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'NEEDS_REVIEW'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl?: string | null
  phone?: string | null
}

export interface StudentProfile {
  id: string
  university?: string | null
  batch?: string | null
  branch?: string | null
  cgpa?: number | null
  bio?: string | null
  location?: string | null
  linkedinUrl?: string | null
  githubUser?: string | null
  portfolioUrl?: string | null
  graduationYear?: number | null
  profileCompletion: number
}

export interface RecruiterProfile {
  id: string
  companyId?: string | null
  company?: { id: string; name: string; industry?: string | null } | null
  position?: string | null
}

export interface OfficerProfile {
  id: string
  department?: string | null
  title?: string | null
}

export interface Skill {
  id: string
  canonicalName: string
  displayName: string
  category?: string | null
}

export interface StudentSkill {
  id: string
  skillId: string
  skill: { id: string; displayName: string; canonicalName: string; category?: string | null }
  selfRated?: string | null
  isClaimed: boolean
  isVerified: boolean
  source?: string | null
  addedAt: string
}

export interface Evidence {
  id: string
  studentId: string
  type: string
  title: string
  description?: string | null
  sourceUrl?: string | null
  organization?: string | null
  assessor?: string | null
  score?: number | null
  maxScore?: number | null
  submittedAt: string
  status: EvidenceStatus
  reviewerId?: string | null
  reviewerNotes?: string | null
  reviewedAt?: string | null
  skills: Array<{ skillId: string; skill: { id: string; displayName: string }; relevance: number }>
}

export interface EvidenceReviewRecord {
  id: string
  evidenceId: string
  reviewerId: string
  reviewer: { id: string; name: string }
  action: string
  status: string
  reason?: string | null
  notes?: string | null
  createdAt: string
}

export interface Job {
  id: string
  title: string
  companyId: string
  company: { id: string; name: string; industry?: string | null }
  description: string
  location?: string | null
  workArrangement?: string | null
  employmentType?: string | null
  minExperience?: number | null
  maxExperience?: number | null
  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  applicationUrl?: string | null
  postingDate: string
  closingDate?: string | null
  status: JobStatus
  sourceType: JobSourceType
  sourceUrl?: string | null
  externalId?: string | null
  batchEligible?: string | null
  eligibilityCriteria?: string | null
  requirements?: Array<{
    id: string
    skillId: string
    skill: { id: string; displayName: string; category?: string | null }
    weight: number
    isRequired: boolean
    minLevel?: string | null
  }>
  _count?: { applications: number; matches: number }
}

export interface MatchResult {
  id: string
  jobId: string
  studentId: string
  job?: { id: string; title: string; company: { name: string } }
  student?: {
    id: string
    user: { id: string; name: string; email: string }
    branch?: string | null
    batch?: string | null
    cgpa?: number | null
  }
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: string // JSON
  missingSkills: string // JSON
  explanation: string // JSON
  algorithmVersion: string
  createdAt: string
  updatedAt: string
}

export interface Application {
  id: string
  studentId: string
  jobId: string
  student?: {
    id: string
    user: { id: string; name: string; email: string }
    branch?: string | null
    batch?: string | null
    cgpa?: number | null
  }
  job?: {
    id: string
    title: string
    company: { id: string; name: string }
  }
  resumeId?: string | null
  status: ApplicationStatus
  coverLetter?: string | null
  appliedAt: string
  updatedAt: string
  notes?: string | null
  events?: ApplicationEvent[]
  interviews?: Interview[]
  offer?: Offer | null
}

export interface ApplicationEvent {
  id: string
  applicationId: string
  previousStatus?: string | null
  newStatus: string
  actorId: string
  actor?: { id: string; name: string }
  reason?: string | null
  timestamp: string
}

export interface Interview {
  id: string
  applicationId: string
  scheduledAt: string
  duration?: number | null
  location?: string | null
  meetingUrl?: string | null
  type: string
  round: number
  notes?: string | null
  outcome?: string | null
}

export interface Offer {
  id: string
  applicationId: string
  amount?: number | null
  currency?: string | null
  decision: string
  expiresAt?: string | null
}

export interface Resume {
  id: string
  studentId: string
  jobId?: string | null
  job?: { id: string; title: string } | null
  version: number
  title: string
  summary?: string | null
  content?: string | null
  isGenerated: boolean
  claimValidation?: string | null
  createdAt: string
  updatedAt: string
  bullets?: ResumeBullet[]
}

export interface ResumeBullet {
  id: string
  resumeId: string
  section: string
  text: string
  skillIds?: string | null
  evidenceIds?: string | null
  claimStatus: ClaimStatus
  orderIndex: number
}

export interface DuplicateJob {
  id: string
  jobAId: string
  jobBId: string
  jobA: Job
  jobB: Job
  status: 'POSSIBLE' | 'CONFIRMED' | 'REJECTED' | 'MERGED'
  similarity: number
  reasons: string
  detectedAt: string
  resolvedAt?: string | null
  resolvedBy?: string | null
  notes?: string | null
}

export interface Notification {
  id: string
  userId: string
  type: string
  title: string
  message: string
  link?: string | null
  read: boolean
  createdAt: string
}

export interface AuditEvent {
  id: string
  actorId: string
  actor?: { id: string; name: string }
  action: string
  targetType?: string | null
  targetId?: string | null
  reason?: string | null
  metadata?: string | null
  timestamp: string
}

// Dashboard metric shapes (subset of what the API returns)
export interface StudentDashboard {
  profileCompletion: number
  supportedSkillsCount: number
  unverifiedSkillsCount: number
  suitableJobsCount: number
  avgFitScore: number
  activeApplicationsCount: number
  recentMatches?: MatchResult[]
  upcomingInterviews?: Interview[]
  missingSkillsForTopMatch?: Array<{ name: string; isRequired: boolean }>
}

export interface OfficerDashboard {
  totalActiveStudents: number
  totalOpenJobs: number
  pendingEvidenceCount: number
  totalMatchesComputed: number
  applicationsByStage: Record<string, number>
  totalInterviews: number
  totalOffers: number
  jobsBySource: Record<string, number>
  recentActivity: Array<ApplicationEvent & { studentName?: string; jobTitle?: string; companyName?: string }>
}

export interface RecruiterDashboard {
  openJobsForCompany: number
  totalCandidates: number
  shortlistedCount: number
  candidatesNeedingReview: number
  stageDistribution: Record<string, number>
  recentActivity: Array<ApplicationEvent & { studentName?: string; jobTitle?: string; companyName?: string }>
}
