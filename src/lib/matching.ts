import { db } from './db'

// ============================================================
// SKILL NORMALIZATION ENGINE
// ============================================================
// Maps raw skill names from job descriptions / student claims
// to canonical skills using a deterministic alias dictionary.
// Case-insensitive, whitespace-insensitive.

export function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Hard-coded common aliases that we cannot store in DB yet.
// These are merged with DB aliases at lookup time.
const BUILTIN_ALIASES: Record<string, string> = {
  'reactjs': 'react',
  'react.js': 'react',
  'react js': 'react',
  'reactjs framework': 'react',
  'postgres': 'postgresql',
  'postgres sql': 'postgresql',
  'node': 'node.js',
  'nodejs': 'node.js',
  'node js': 'node.js',
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'python3': 'python',
  'golang': 'go',
  'k8s': 'kubernetes',
  'aws lambda': 'aws lambda',
  'tailwindcss': 'tailwind css',
  'tailwind': 'tailwind css',
  'expressjs': 'express',
  'express.js': 'express',
  'c++': 'c++',
  'c plus plus': 'c++',
  'c#': 'c#',
  'csharp': 'c#',
  'c sharp': 'c#',
  'dotnet': '.net',
  '.net core': 'asp.net core',
  'aspnet': 'asp.net',
  'ml': 'machine learning',
  'ai': 'artificial intelligence',
  'dl': 'deep learning',
  'nlp': 'natural language processing',
  'css3': 'css',
  'html5': 'html',
  'mongodb': 'mongodb',
  'mongo': 'mongodb',
  'redis cache': 'redis',
  'docker compose': 'docker',
  'rest apis': 'rest api',
  'restful api': 'rest api',
  'restful': 'rest api',
  'graphql apis': 'graphql',
  'vuejs': 'vue',
  'vue.js': 'vue',
  'vue js': 'vue',
  'angularjs': 'angular',
  'angular.js': 'angular',
  'sveltekit': 'svelte',
  'spring boot': 'spring boot',
  'springboot': 'spring boot',
}

// Cache to avoid repeated DB queries during a single scoring run
let canonicalMapCache: Map<string, { skillId: string; displayName: string } | null> | null = null

async function loadCanonicalMap(): Promise<Map<string, { skillId: string; displayName: string } | null>> {
  if (canonicalMapCache) return canonicalMapCache
  const map = new Map<string, { skillId: string; displayName: string } | null>()

  // 1. Preload builtin aliases (resolve to canonicalName)
  for (const [alias, canonical] of Object.entries(BUILTIN_ALIASES)) {
    map.set(alias, null) // placeholder until canonical skill loaded
  }

  // 2. Load all canonical skills + aliases from DB
  const skills = await db.skill.findMany({
    include: { aliases: true },
  })
  // Build by canonical
  for (const s of skills) {
    const norm = normalizeSkillName(s.canonicalName)
    map.set(norm, { skillId: s.id, displayName: s.displayName })
    map.set(normalizeSkillName(s.displayName), { skillId: s.id, displayName: s.displayName })
    for (const a of s.aliases) {
      map.set(normalizeSkillName(a.caseInsensitive), { skillId: s.id, displayName: s.displayName })
    }
  }

  // 3. Resolve builtin aliases that map to canonical skills
  for (const [alias, placeholder] of Array.from(map.entries())) {
    if (placeholder === null) {
      const canonical = BUILTIN_ALIASES[alias]
      if (!canonical) continue
      // try canonical alias
      const direct = map.get(normalizeSkillName(canonical))
      if (direct) map.set(alias, direct)
      else if (BUILTIN_ALIASES[normalizeSkillName(canonical)]) {
        // double-alias chain
        const c2 = BUILTIN_ALIASES[normalizeSkillName(canonical)]
        const d2 = map.get(normalizeSkillName(c2))
        if (d2) map.set(alias, d2)
      }
    }
  }

  canonicalMapCache = map
  return map
}

export function clearNormalizationCache() {
  canonicalMapCache = null
}

export async function normalizeSkill(
  rawName: string
): Promise<{ skillId: string; displayName: string } | null> {
  const map = await loadCanonicalMap()
  return map.get(normalizeSkillName(rawName)) ?? null
}

export async function normalizeSkills(
  rawNames: string[]
): Promise<Array<{ rawName: string; canonical: { skillId: string; displayName: string } | null }>> {
  const map = await loadCanonicalMap()
  return rawNames.map(name => ({
    rawName: name,
    canonical: map.get(normalizeSkillName(name)) ?? null,
  }))
}

// ============================================================
// JOB-FIT SCORING ENGINE
// ============================================================
// Fit score = 100 × (Σ weight × evidenceMatchValue) / (Σ weights)
// where evidenceMatchValue ∈ [0,1]
// Weights: required=4, preferred=1
//
// Evidence match value policy:
//  - No evidence: 0
//  - Submitted but pending/unverified: 0.25 (partial provisional credit)
//  - Rejected/needs_more_evidence: 0
//  - Verified: 1.0 (scaled by relevance)
//
// Multiple evidence for same skill: take the maximum contribution,
// so a student can't inflate score by attaching many similar links.

export const SCORING_ALGORITHM_VERSION = 'v1.0'

export interface EvidenceMatch {
  evidenceId: string
  status: string // VERIFIED | PENDING_REVIEW | UNVERIFIED | REJECTED | NEEDS_MORE_EVIDENCE
  relevance: number
  type: string
  title: string
}

export interface SkillRequirementForScoring {
  skillId: string
  displayName: string
  isRequired: boolean
  weight: number
}

export interface StudentSkillEvidenceForScoring {
  skillId: string
  evidence: EvidenceMatch[]
}

export interface ScoreBreakdown {
  skillId: string
  displayName: string
  isRequired: boolean
  weight: number
  matchValue: number
  bestEvidence?: EvidenceMatch
  evidenceCount: number
}

export interface MatchExplanation {
  fitScore: number
  requiredCoverage: number
  preferredCoverage: number
  matchingSkills: Array<{ skillId: string; name: string; evidenceIds: string[] }>
  missingSkills: Array<{ skillId: string; name: string; weight: number; isRequired: boolean; status: string }>
  breakdown: ScoreBreakdown[]
  factorsSummary: string
  recommendation: string
  algorithmVersion: string
  inputsSnapshot: string
}

const EVIDENCE_VALUE_RULES: Record<string, number> = {
  VERIFIED: 1.0,
  PENDING_REVIEW: 0.25,
  UNVERIFIED: 0.25,
  REJECTED: 0,
  NEEDS_MORE_EVIDENCE: 0,
}

function deduplicateSkillContribution(evidence: EvidenceMatch[]): { matchValue: number; best?: EvidenceMatch } {
  if (!evidence || evidence.length === 0) return { matchValue: 0 }
  // Take max contribution across all evidence items
  let best: EvidenceMatch | undefined
  let max = 0
  for (const ev of evidence) {
    const base = EVIDENCE_VALUE_RULES[ev.status] ?? 0
    const value = base * Math.max(0, Math.min(1, ev.relevance))
    if (value > max) {
      max = value
      best = ev
    }
  }
  return { matchValue: max, best }
}

export function calculateMatch(
  requirements: SkillRequirementForScoring[],
  studentEvidence: StudentSkillEvidenceForScoring[]
): MatchExplanation {
  const studentEvidenceMap = new Map(studentEvidence.map(se => [se.skillId, se.evidence]))

  const breakdown: ScoreBreakdown[] = []
  const matchingSkills: MatchExplanation['matchingSkills'] = []
  const missingSkills: MatchExplanation['missingSkills'] = []

  let totalWeightedMatch = 0
  let totalWeight = 0
  let reqCovered = 0
  let reqTotal = 0
  let prefCovered = 0
  let prefTotal = 0

  for (const req of requirements) {
    const ev = studentEvidenceMap.get(req.skillId) ?? []
    const { matchValue, best } = deduplicateSkillContribution(ev)
    totalWeightedMatch += req.weight * matchValue
    totalWeight += req.weight

    if (req.isRequired) {
      reqTotal += 1
      if (matchValue >= 0.25) reqCovered += 1
      if (matchValue === 0) {
        missingSkills.push({
          skillId: req.skillId,
          name: req.displayName,
          weight: req.weight,
          isRequired: true,
          status: ev.length === 0 ? 'NO_EVIDENCE' : 'INSUFFICIENT_EVIDENCE',
        })
      }
    } else {
      prefTotal += 1
      if (matchValue >= 0.25) prefCovered += 1
      if (matchValue === 0) {
        missingSkills.push({
          skillId: req.skillId,
          name: req.displayName,
          weight: req.weight,
          isRequired: false,
          status: ev.length === 0 ? 'NO_EVIDENCE' : 'INSUFFICIENT_EVIDENCE',
        })
      }
    }

    if (matchValue >= 0.25 && best) {
      matchingSkills.push({
        skillId: req.skillId,
        name: req.displayName,
        evidenceIds: ev.filter(e => EVIDENCE_VALUE_RULES[e.status] > 0).map(e => e.evidenceId),
      })
    }

    breakdown.push({
      skillId: req.skillId,
      displayName: req.displayName,
      isRequired: req.isRequired,
      weight: req.weight,
      matchValue,
      bestEvidence: best,
      evidenceCount: ev.length,
    })
  }

  const fitScore = totalWeight === 0 ? 0 : Math.round((totalWeightedMatch / totalWeight) * 1000) / 10
  const requiredCoverage = reqTotal === 0 ? 1 : reqCovered / reqTotal
  const preferredCoverage = prefTotal === 0 ? 1 : prefCovered / prefTotal

  // Build human-readable factors summary
  const topMatched = breakdown
    .filter(b => b.matchValue > 0)
    .sort((a, b) => b.matchValue * b.weight - a.matchValue * a.weight)
    .slice(0, 3)
  const topMissing = missingSkills.filter(m => m.isRequired).slice(0, 3)

  const factorsSummary = topMatched.length
    ? `Strong evidence for ${topMatched.map(b => b.displayName).join(', ')}.`
    : 'No verified supporting evidence yet.'

  const recommendation = topMissing.length
    ? `Strengthen evidence for required skills: ${topMissing.map(m => m.name).join(', ')}.`
    : 'Profile meets all required skills — focus on preferred skills and interview prep.'

  const inputsSnapshot = JSON.stringify({
    requirements: requirements.map(r => ({ skillId: r.skillId, weight: r.weight, isRequired: r.isRequired })),
    studentEvidence: studentEvidence.map(se => ({ skillId: se.skillId, count: se.evidence.length })),
  })

  return {
    fitScore,
    requiredCoverage,
    preferredCoverage,
    matchingSkills,
    missingSkills,
    breakdown,
    factorsSummary,
    recommendation,
    algorithmVersion: SCORING_ALGORITHM_VERSION,
    inputsSnapshot,
  }
}

// ============================================================
// DUPLICATE JOB DETECTION
// ============================================================
// Detects duplicates through layers:
// 1. Exact external source and external ID
// 2. Canonicalized source URL
// 3. Normalized company + title + location
// 4. Description similarity (Jaccard on tokenized words)
// Returns similarity in [0,1] and a list of reasons.

export function canonicalizeUrl(url: string): string {
  try {
    let u = url.trim().toLowerCase()
    u = u.replace(/^https?:\/\//, '').replace(/^www\./, '')
    u = u.replace(/\/+$/, '')
    return u
  } catch {
    return url.toLowerCase()
  }
}

export function tokenize(text: string): Set<string> {
  if (!text) return new Set()
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
  return new Set(tokens)
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was',
  'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may',
  'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'men',
  'put', 'say', 'she', 'too', 'use', 'with', 'this', 'that', 'from', 'have',
  'they', 'will', 'what', 'when', 'your', 'their', 'them', 'were', 'been',
  'into', 'over', 'such', 'about', 'after', 'would', 'could', 'should', 'than',
  'then', 'these', 'those', 'only', 'very', 'also', 'must', 'more', 'most',
  'some', 'any', 'each', 'other', 'job', 'role', 'work', 'team', 'good', 'need',
  'join', 'year', 'years', 'company', 'we', 'our', 'us', 'etc', 'like',
])

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a)
  const tb = tokenize(b)
  if (ta.size === 0 && tb.size === 0) return 1
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const union = ta.size + tb.size - inter
  return union === 0 ? 0 : inter / union
}

export interface DuplicateCandidate {
  jobAId: string
  jobBId: string
  similarity: number
  reasons: string[]
  status: 'POSSIBLE' | 'CONFIRMED'
}

export function detectDuplicate(a: {
  id: string
  title: string
  company: string
  location?: string | null
  description: string
  sourceUrl?: string | null
  externalId?: string | null
  sourceType?: string | null
}, b: sameType): DuplicateCandidate | null {
  type sameType = typeof a
  const reasons: string[] = []
  let score = 0

  // 1. Exact external source + external ID
  if (a.externalId && b.externalId && a.externalId === b.externalId && a.sourceType === b.sourceType) {
    reasons.push('Same external ID from same source')
    score = 1.0
    return {
      jobAId: a.id,
      jobBId: b.id,
      similarity: 1.0,
      reasons,
      status: 'CONFIRMED',
    }
  }

  // 2. Canonicalized source URL
  if (a.sourceUrl && b.sourceUrl && canonicalizeUrl(a.sourceUrl) === canonicalizeUrl(b.sourceUrl)) {
    reasons.push('Identical source URL')
    score = Math.max(score, 0.95)
  }

  // 3. Normalized company + title + location
  const aTitle = a.title.trim().toLowerCase()
  const bTitle = b.title.trim().toLowerCase()
  const aCompany = a.company.trim().toLowerCase()
  const bCompany = b.company.trim().toLowerCase()
  const aLoc = (a.location ?? '').trim().toLowerCase()
  const bLoc = (b.location ?? '').trim().toLowerCase()

  if (aTitle === bTitle && aCompany === bCompany) {
    reasons.push('Same title and company')
    score = Math.max(score, 0.7)
    if (aLoc && bLoc && aLoc === bLoc) {
      reasons.push('Same location')
      score = Math.max(score, 0.8)
    }
  }

  // 4. Description similarity
  const descSim = jaccardSimilarity(a.description, b.description)
  if (descSim >= 0.6) {
    reasons.push(`High description similarity (${(descSim * 100).toFixed(0)}%)`)
    score = Math.max(score, descSim * 0.9)
  } else if (descSim >= 0.3) {
    reasons.push(`Moderate description similarity (${(descSim * 100).toFixed(0)}%)`)
    score = Math.max(score, descSim * 0.5)
  }

  if (score < 0.4) return null
  return {
    jobAId: a.id,
    jobBId: b.id,
    similarity: Math.min(1, score),
    reasons,
    status: score >= 0.9 ? 'CONFIRMED' : 'POSSIBLE',
  }
}
