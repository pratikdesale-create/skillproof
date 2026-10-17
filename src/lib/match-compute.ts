// Match computation helper — mirrors the inline logic in scripts/seed.ts but
// uses the matching engine's `calculateMatch` function from src/lib/matching.ts.
// This file does NOT modify matching.ts; it only imports from it.

import { db } from './db'
import {
  calculateMatch,
  type SkillRequirementForScoring,
  type StudentSkillEvidenceForScoring,
  type MatchExplanation,
  SCORING_ALGORITHM_VERSION,
} from './matching'

/** Compute the full match explanation for one (job, student) pair. */
export async function computeMatchFor(jobId: string, studentId: string): Promise<MatchExplanation | null> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { requirements: { include: { skill: true } } },
  })
  if (!job || job.requirements.length === 0) return null

  const student = await db.studentProfile.findUnique({
    where: { id: studentId },
    include: {
      evidence: {
        include: { skills: true },
      },
    },
  })
  if (!student) return null

  const reqs: SkillRequirementForScoring[] = job.requirements.map(r => ({
    skillId: r.skillId,
    displayName: r.skill.displayName,
    isRequired: r.isRequired,
    weight: r.weight,
  }))

  const studentEvidence: StudentSkillEvidenceForScoring[] = job.requirements.map(r => {
    const skillEvidence = student.evidence
      .filter(e => e.skills.some(es => es.skillId === r.skillId))
      .map(e => ({
        evidenceId: e.id,
        status: e.status,
        relevance: e.skills.find(es => es.skillId === r.skillId)?.relevance ?? 1,
        type: e.type,
        title: e.title,
      }))
    return { skillId: r.skillId, evidence: skillEvidence }
  })

  return calculateMatch(reqs, studentEvidence)
}

/** Upsert a MatchResult record in DB. */
export async function upsertMatchResult(jobId: string, studentId: string, m: MatchExplanation) {
  await db.matchResult.upsert({
    where: { jobId_studentId: { jobId, studentId } },
    update: {
      fitScore: m.fitScore,
      requiredCoverage: m.requiredCoverage,
      preferredCoverage: m.preferredCoverage,
      matchingSkills: JSON.stringify(m.matchingSkills),
      missingSkills: JSON.stringify(m.missingSkills),
      // P3 fix: persist the separated coverage tiers + provisional skills
      // so the API can expose them without recomputing.
      explanation: JSON.stringify({
        breakdown: m.breakdown,
        factorsSummary: m.factorsSummary,
        recommendation: m.recommendation,
        verifiedRequiredCoverage: m.verifiedRequiredCoverage,
        provisionalRequiredCoverage: m.provisionalRequiredCoverage,
        missingRequiredCoverage: m.missingRequiredCoverage,
        verifiedPreferredCoverage: m.verifiedPreferredCoverage,
        provisionalPreferredCoverage: m.provisionalPreferredCoverage,
        missingPreferredCoverage: m.missingPreferredCoverage,
        provisionalSkills: m.provisionalSkills,
      }),
      algorithmVersion: SCORING_ALGORITHM_VERSION,
      inputs: m.inputsSnapshot,
    },
    create: {
      jobId,
      studentId,
      fitScore: m.fitScore,
      requiredCoverage: m.requiredCoverage,
      preferredCoverage: m.preferredCoverage,
      matchingSkills: JSON.stringify(m.matchingSkills),
      missingSkills: JSON.stringify(m.missingSkills),
      explanation: JSON.stringify({
        breakdown: m.breakdown,
        factorsSummary: m.factorsSummary,
        recommendation: m.recommendation,
        verifiedRequiredCoverage: m.verifiedRequiredCoverage,
        provisionalRequiredCoverage: m.provisionalRequiredCoverage,
        missingRequiredCoverage: m.missingRequiredCoverage,
        verifiedPreferredCoverage: m.verifiedPreferredCoverage,
        provisionalPreferredCoverage: m.provisionalPreferredCoverage,
        missingPreferredCoverage: m.missingPreferredCoverage,
        provisionalSkills: m.provisionalSkills,
      }),
      algorithmVersion: SCORING_ALGORITHM_VERSION,
      inputs: m.inputsSnapshot,
    },
  })
}
