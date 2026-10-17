import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'
import { safeParseJson } from '@/lib/api-helpers'

// GET /api/career-resources — STUDENT only.
// Returns curated learning resources based on the student's skill gaps.
// Resources are deterministic + curated (no fabricated content).
// Gaps are computed from existing match results: any "required" skill
// that appears in missingSkills across the student's matches is a gap.

interface CuratedResource {
  skillName: string
  skillDisplayName: string
  category: string
  resourceType: 'course' | 'docs' | 'practice' | 'video'
  title: string
  provider: string
  url: string
  duration: string
  notes: string
}

// Curated catalog — only real, well-known resources. No invented links.
const RESOURCE_CATALOG: Record<string, CuratedResource[]> = {
  docker: [
    { skillName: 'docker', skillDisplayName: 'Docker', category: 'tool', resourceType: 'docs', title: 'Docker official documentation', provider: 'Docker Inc.', url: 'https://docs.docker.com/', duration: '4-6 hours', notes: 'Start with the Get Started guide and try the official tutorial.' },
    { skillName: 'docker', skillDisplayName: 'Docker', category: 'tool', resourceType: 'course', title: 'Docker for Developers', provider: 'freeCodeCamp', url: 'https://www.freecodecamp.org/news/the-docker-handbook/', duration: '4 hours', notes: 'Free comprehensive guide with hands-on examples.' },
  ],
  kubernetes: [
    { skillName: 'kubernetes', skillDisplayName: 'Kubernetes', category: 'tool', resourceType: 'docs', title: 'Kubernetes official documentation', provider: 'CNCF', url: 'https://kubernetes.io/docs/', duration: '6-8 hours', notes: 'Begin with "Hello, Kubernetes" tutorial.' },
    { skillName: 'kubernetes', skillDisplayName: 'Kubernetes', category: 'tool', resourceType: 'course', title: 'Kubernetes for the Absolute Beginners', provider: 'KodeKloud', url: 'https://kodekloud.com/courses/kubernetes-for-the-absolute-beginners/', duration: '4 hours', notes: 'Hands-on interactive course with playground.' },
  ],
  aws: [
    { skillName: 'aws', skillDisplayName: 'AWS', category: 'cloud', resourceType: 'docs', title: 'AWS Skill Builder', provider: 'Amazon Web Services', url: 'https://aws.amazon.com/training/', duration: '8+ hours', notes: 'Free foundational cloud courses.' },
    { skillName: 'aws', skillDisplayName: 'AWS', category: 'cloud', resourceType: 'course', title: 'AWS Cloud Practitioner Essentials', provider: 'AWS', url: 'https://www.aws.training/details/curriculum?ctid=29', duration: '6 hours', notes: 'Free course — covers core services.' },
  ],
  'ci/cd': [
    { skillName: 'ci/cd', skillDisplayName: 'CI/CD', category: 'tool', resourceType: 'docs', title: 'GitHub Actions documentation', provider: 'GitHub', url: 'https://docs.github.com/en/actions', duration: '3 hours', notes: 'Start with the Quickstart guide.' },
  ],
  'system design': [
    { skillName: 'system design', skillDisplayName: 'System Design', category: 'cs', resourceType: 'course', title: 'System Design Primer', provider: 'Open source', url: 'https://github.com/donnemartin/system-design-primer', duration: '10+ hours', notes: 'Free, comprehensive, with Anki flashcards.' },
  ],
  graphql: [
    { skillName: 'graphql', skillDisplayName: 'GraphQL', category: 'api', resourceType: 'docs', title: 'GraphQL official tutorial', provider: 'GraphQL Foundation', url: 'https://graphql.org/learn/', duration: '4 hours', notes: 'Start with the official Introduction.' },
  ],
  'machine learning': [
    { skillName: 'machine learning', skillDisplayName: 'Machine Learning', category: 'ml', resourceType: 'course', title: 'Machine Learning Specialization', provider: 'Coursera + DeepLearning.AI', url: 'https://www.coursera.org/specializations/machine-learning-introduction', duration: '60 hours', notes: 'Foundational supervised + unsupervised learning.' },
  ],
  'deep learning': [
    { skillName: 'deep learning', skillDisplayName: 'Deep Learning', category: 'ml', resourceType: 'course', title: 'Deep Learning Specialization', provider: 'Coursera + DeepLearning.AI', url: 'https://www.coursera.org/specializations/deep-learning', duration: '80 hours', notes: 'Neural networks, CNNs, RNNs, transformers.' },
  ],
  'natural language processing': [
    { skillName: 'natural language processing', skillDisplayName: 'Natural Language Processing', category: 'ml', resourceType: 'course', title: 'NLP Specialization', provider: 'Coursera + DeepLearning.AI', url: 'https://www.coursera.org/specializations/natural-language-processing', duration: '40 hours', notes: 'Classification, vectors, attention, transformers.' },
  ],
  go: [
    { skillName: 'go', skillDisplayName: 'Go', category: 'language', resourceType: 'docs', title: 'A Tour of Go', provider: 'Go team', url: 'https://go.dev/tour/', duration: '4 hours', notes: 'Interactive tour of the language fundamentals.' },
    { skillName: 'go', skillDisplayName: 'Go', category: 'language', resourceType: 'docs', title: 'Effective Go', provider: 'Go team', url: 'https://go.dev/doc/effective_go', duration: '2 hours', notes: 'Patterns + idioms for writing clean Go.' },
  ],
  java: [
    { skillName: 'java', skillDisplayName: 'Java', category: 'language', resourceType: 'docs', title: 'The Java Tutorials', provider: 'Oracle', url: 'https://docs.oracle.com/javase/tutorial/', duration: '10+ hours', notes: 'Official Java tutorials from Oracle.' },
  ],
  'c++': [
    { skillName: 'c++', skillDisplayName: 'C++', category: 'language', resourceType: 'docs', title: 'LearnCpp.com', provider: 'LearnCpp', url: 'https://www.learncpp.com/', duration: '20+ hours', notes: 'Free, comprehensive C++ tutorial.' },
  ],
  typescript: [
    { skillName: 'typescript', skillDisplayName: 'TypeScript', category: 'language', resourceType: 'docs', title: 'TypeScript Handbook', provider: 'Microsoft', url: 'https://www.typescriptlang.org/docs/handbook/', duration: '4 hours', notes: 'Official handbook — covers all key features.' },
  ],
  postgresql: [
    { skillName: 'postgresql', skillDisplayName: 'PostgreSQL', category: 'database', resourceType: 'docs', title: 'PostgreSQL Tutorial', provider: 'PostgreSQL', url: 'https://www.postgresqltutorial.com/', duration: '6 hours', notes: 'Comprehensive free tutorial.' },
  ],
  redis: [
    { skillName: 'redis', skillDisplayName: 'Redis', category: 'database', resourceType: 'docs', title: 'Redis documentation', provider: 'Redis', url: 'https://redis.io/docs/', duration: '3 hours', notes: 'Start with the Data Types Introduction.' },
  ],
}

// Curated career-readiness articles (not skill-specific).
const CAREER_ARTICLES = [
  { id: 'resume-tailoring', title: 'Tailor your resume for each job application', category: 'Resume', duration: '5 min read', source: 'Placement Hub Guide', summary: 'Why generic resumes fail and how to choose which verified evidence to highlight per role.' },
  { id: 'interview-star', title: 'Use the STAR method for behavioural interviews', category: 'Interview', duration: '8 min read', source: 'Placement Hub Guide', summary: 'Situation, Task, Action, Result — a simple structure for clear, evidence-backed answers.' },
  { id: 'dsa-strategy', title: 'A 30-day plan for DSA interview prep', category: 'Interview', duration: '10 min read', source: 'Placement Hub Guide', summary: 'Recommended daily focus areas with free practice resources.' },
  { id: 'github-portfolio', title: 'Polish your GitHub portfolio', category: 'Profile', duration: '6 min read', source: 'Placement Hub Guide', summary: 'Pinned repos, README quality, contribution graph basics.' },
]

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req)
    if (user.role !== 'STUDENT') throw new ResponseError(403, 'Students only')
    const studentId = await requireStudentProfileId(user)

    // 1. Find skill gaps from match results
    const matches = await db.matchResult.findMany({
      where: { studentId },
      select: { missingSkills: true, jobId: true },
      take: 50,
    })
    const missingSkillIds = new Set<string>()
    const missingSkillCounts = new Map<string, number>()
    for (const m of matches) {
      const missing = safeParseJson<Array<{ skillId: string; name: string; isRequired?: boolean }>>(m.missingSkills, [])
      if (!Array.isArray(missing)) continue
      for (const mk of missing) {
        if (!mk.isRequired) continue
        if (mk.skillId && !missingSkillIds.has(mk.skillId)) {
          missingSkillIds.add(mk.skillId)
          missingSkillCounts.set(mk.skillId, 0)
        }
        if (mk.skillId) {
          missingSkillCounts.set(mk.skillId, (missingSkillCounts.get(mk.skillId) ?? 0) + 1)
        }
      }
    }

    // 2. Fetch skill display names
    const skills = await db.skill.findMany({
      where: { id: { in: Array.from(missingSkillIds) } },
      select: { id: true, displayName: true, canonicalName: true, category: true },
    })

    // 3. Build resource recommendations: only for skills that have curated resources
    const recommendations = skills
      .filter(s => RESOURCE_CATALOG[s.canonicalName])
      .map(s => ({
        skill: { id: s.id, displayName: s.displayName, canonicalName: s.canonicalName, category: s.category },
        gapFrequency: missingSkillCounts.get(s.id) ?? 0,
        resources: RESOURCE_CATALOG[s.canonicalName],
      }))

    return Response.json({
      recommendations,
      careerArticles: CAREER_ARTICLES,
      totalGaps: missingSkillIds.size,
      curatedGaps: recommendations.length,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
