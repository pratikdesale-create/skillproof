/**
 * Skillproof — Unit tests for the security, evidence, and matching fixes.
 *
 * Run with: bunx vitest run
 *
 * These tests cover the spec's "Required testing" items 1, 3, 4, 5, 6, 7, 8, 9.
 * End-to-end tests that require a running dev server (items 2, 10, 11, 12)
 * are documented in scripts/tests/README.md as manual checks.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateMatch,
  normalizeSkillName,
  type SkillRequirementForScoring,
  type StudentSkillEvidenceForScoring,
} from '@/lib/matching'
import {
  validateSkillClaim,
  validateProjectClaim,
  validateAssessmentClaim,
  validateCertificationClaim,
  filterOwnedEvidenceIds,
  statusCredit,
  type EvidenceWithSkills,
} from '@/lib/evidence-validation'

// ----------------------------------------------------------------
// 1. Matching engine — deterministic scores, coverage tiers, alias normalization
// ----------------------------------------------------------------

describe('matching.ts — alias normalisation', () => {
  it('normalises whitespace and case', () => {
    expect(normalizeSkillName('  React  ')).toBe('react')
    expect(normalizeSkillName('REACT')).toBe('react')
    expect(normalizeSkillName('React   JS')).toBe('react js')
  })
})

describe('matching.ts — deterministic scores', () => {
  const baseReqs: SkillRequirementForScoring[] = [
    { skillId: 'js', displayName: 'JavaScript', isRequired: true, weight: 4 },
    { skillId: 'react', displayName: 'React', isRequired: true, weight: 4 },
    { skillId: 'ts', displayName: 'TypeScript', isRequired: false, weight: 1 },
  ]

  it('returns fitScore=0 when student has no evidence', () => {
    const studentEvidence: StudentSkillEvidenceForScoring[] = []
    const m = calculateMatch(baseReqs, studentEvidence)
    expect(m.fitScore).toBe(0)
    expect(m.verifiedRequiredCoverage).toBe(0)
    expect(m.provisionalRequiredCoverage).toBe(0)
    expect(m.missingRequiredCoverage).toBe(1)
  })

  it('returns fitScore=100 when all required AND preferred skills are VERIFIED', () => {
    // Use a requirements set where covering everything means 100%
    const reqs: SkillRequirementForScoring[] = [
      { skillId: 'js', displayName: 'JavaScript', isRequired: true, weight: 4 },
      { skillId: 'react', displayName: 'React', isRequired: true, weight: 4 },
    ]
    const studentEvidence: StudentSkillEvidenceForScoring[] = [
      { skillId: 'js', evidence: [{ evidenceId: 'e1', status: 'VERIFIED', relevance: 1, type: 'assessment', title: 'JS test' }] },
      { skillId: 'react', evidence: [{ evidenceId: 'e2', status: 'VERIFIED', relevance: 1, type: 'project', title: 'React project' }] },
    ]
    const m = calculateMatch(reqs, studentEvidence)
    expect(m.fitScore).toBe(100)
    expect(m.verifiedRequiredCoverage).toBe(1)
    expect(m.provisionalRequiredCoverage).toBe(0)
    expect(m.missingRequiredCoverage).toBe(0)
  })

  it('does not give full credit for provisional (pending) evidence', () => {
    // Two required skills, both with pending evidence only.
    // Formula: 100 * (4*0.25 + 4*0.25) / (4+4) = 100 * 2/8 = 25
    const reqs: SkillRequirementForScoring[] = [
      { skillId: 'js', displayName: 'JavaScript', isRequired: true, weight: 4 },
      { skillId: 'react', displayName: 'React', isRequired: true, weight: 4 },
    ]
    const studentEvidence: StudentSkillEvidenceForScoring[] = [
      { skillId: 'js', evidence: [{ evidenceId: 'e1', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'JS project' }] },
      { skillId: 'react', evidence: [{ evidenceId: 'e2', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'React project' }] },
    ]
    const m = calculateMatch(reqs, studentEvidence)
    expect(m.fitScore).toBe(25)
    // P3 fix: verified=0, provisional=1, missing=0
    expect(m.verifiedRequiredCoverage).toBe(0)
    expect(m.provisionalRequiredCoverage).toBe(1)
    expect(m.missingRequiredCoverage).toBe(0)
    expect(m.provisionalSkills).toHaveLength(2)
  })

  it('does not multiply credit for duplicate evidence on the same skill', () => {
    // Multiple evidence for the same skill — should take MAX contribution, not sum
    const studentEvidence: StudentSkillEvidenceForScoring[] = [
      {
        skillId: 'js', evidence: [
          { evidenceId: 'e1', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'JS proj 1' },
          { evidenceId: 'e2', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'JS proj 2' },
          { evidenceId: 'e3', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'JS proj 3' },
        ],
      },
    ]
    const m = calculateMatch(baseReqs.slice(0, 1), studentEvidence)
    // 3 pending-evidence items for the same skill → still 0.25 credit (max), not 0.75 (sum)
    expect(m.fitScore).toBe(25)
  })

  it('separates verified, provisional, and missing coverage correctly', () => {
    const reqs: SkillRequirementForScoring[] = [
      { skillId: 'a', displayName: 'A', isRequired: true, weight: 4 }, // verified
      { skillId: 'b', displayName: 'B', isRequired: true, weight: 4 }, // provisional
      { skillId: 'c', displayName: 'C', isRequired: true, weight: 4 }, // missing
      { skillId: 'd', displayName: 'D', isRequired: true, weight: 4 }, // rejected
    ]
    const studentEvidence: StudentSkillEvidenceForScoring[] = [
      { skillId: 'a', evidence: [{ evidenceId: 'ea', status: 'VERIFIED', relevance: 1, type: 'assessment', title: 'A' }] },
      { skillId: 'b', evidence: [{ evidenceId: 'eb', status: 'PENDING_REVIEW', relevance: 1, type: 'project', title: 'B' }] },
      // c has no evidence
      { skillId: 'd', evidence: [{ evidenceId: 'ed', status: 'REJECTED', relevance: 1, type: 'project', title: 'D' }] },
    ]
    const m = calculateMatch(reqs, studentEvidence)
    // Required coverage tiers: 1 verified + 1 provisional + 2 missing = 4 total
    expect(m.verifiedRequiredCoverage).toBe(0.25) // 1/4
    expect(m.provisionalRequiredCoverage).toBe(0.25) // 1/4
    expect(m.missingRequiredCoverage).toBe(0.5) // 2/4 (c + d)
    expect(m.missingSkills).toHaveLength(2)
    expect(m.provisionalSkills).toHaveLength(1)
  })

  it('handles empty requirements list safely', () => {
    const m = calculateMatch([], [])
    expect(m.fitScore).toBe(0)
    // By convention, empty requirements = verifiedCoverage = 1.0
    expect(m.verifiedRequiredCoverage).toBe(1)
    expect(m.missingRequiredCoverage).toBe(0)
  })
})

// ----------------------------------------------------------------
// 2. Evidence validation library
// ----------------------------------------------------------------

describe('evidence-validation.ts — status credit', () => {
  it('returns 1.0 for VERIFIED', () => {
    expect(statusCredit('VERIFIED')).toBe(1.0)
  })
  it('returns 0.25 for PENDING_REVIEW and UNVERIFIED', () => {
    expect(statusCredit('PENDING_REVIEW')).toBe(0.25)
    expect(statusCredit('UNVERIFIED')).toBe(0.25)
  })
  it('returns 0 for REJECTED and NEEDS_MORE_EVIDENCE', () => {
    expect(statusCredit('REJECTED')).toBe(0)
    expect(statusCredit('NEEDS_MORE_EVIDENCE')).toBe(0)
  })
})

describe('evidence-validation.ts — validateSkillClaim', () => {
  const evidence: EvidenceWithSkills[] = [
    { id: 'e1', status: 'VERIFIED', skills: [{ skillId: 'js', relevance: 1 }] } as unknown as EvidenceWithSkills,
    { id: 'e2', status: 'PENDING_REVIEW', skills: [{ skillId: 'react', relevance: 1 }] } as unknown as EvidenceWithSkills,
    { id: 'e3', status: 'REJECTED', skills: [{ skillId: 'ts', relevance: 1 }] } as unknown as EvidenceWithSkills,
  ]

  it('returns SUPPORTED when a verified evidence record links to the skill', () => {
    const c = validateSkillClaim('js', evidence)
    expect(c.status).toBe('SUPPORTED')
    expect(c.evidenceIds).toContain('e1')
  })

  it('returns NEEDS_REVIEW when only pending evidence links to the skill', () => {
    const c = validateSkillClaim('react', evidence)
    expect(c.status).toBe('NEEDS_REVIEW')
    expect(c.evidenceIds).toContain('e2')
  })

  it('returns UNSUPPORTED when no evidence links to the skill', () => {
    const c = validateSkillClaim('java', evidence)
    expect(c.status).toBe('UNSUPPORTED')
    expect(c.evidenceIds).toHaveLength(0)
  })

  it('returns UNSUPPORTED when all linked evidence is rejected', () => {
    const c = validateSkillClaim('ts', evidence)
    expect(c.status).toBe('UNSUPPORTED')
  })
})

describe('evidence-validation.ts — validateProjectClaim (P2 fix)', () => {
  const allEvidence: EvidenceWithSkills[] = [
    { id: 'e_proj1', status: 'VERIFIED', skills: [] } as unknown as EvidenceWithSkills,
    { id: 'e_proj2', status: 'PENDING_REVIEW', skills: [] } as unknown as EvidenceWithSkills,
    { id: 'e_proj_other', status: 'VERIFIED', skills: [] } as unknown as EvidenceWithSkills, // unrelated project evidence
  ]

  it('returns UNSUPPORTED when project has no explicitly linked evidence', () => {
    // SECURITY (P2 fix): previously, ALL project/github/demo evidence was
    // attached to every project. Now we require an explicit Project.evidenceId link.
    const c = validateProjectClaim({ id: 'p1', evidenceId: null }, allEvidence)
    expect(c.status).toBe('UNSUPPORTED')
    expect(c.evidenceIds).toHaveLength(0)
    expect(c.reason).toContain('no explicitly linked evidence')
  })

  it('returns SUPPORTED when project has a linked VERIFIED evidence', () => {
    const c = validateProjectClaim({ id: 'p1', evidenceId: 'e_proj1' }, allEvidence)
    expect(c.status).toBe('SUPPORTED')
    expect(c.evidenceIds).toEqual(['e_proj1'])
  })

  it('returns NEEDS_REVIEW when project has linked PENDING evidence', () => {
    const c = validateProjectClaim({ id: 'p2', evidenceId: 'e_proj2' }, allEvidence)
    expect(c.status).toBe('NEEDS_REVIEW')
  })

  it('does NOT auto-attach unrelated project evidence', () => {
    // Even though e_proj_other exists and is VERIFIED, it should NOT be
    // attached to project p1 (which has no explicit evidenceId link).
    const c = validateProjectClaim({ id: 'p1', evidenceId: null }, allEvidence)
    expect(c.status).toBe('UNSUPPORTED')
    expect(c.evidenceIds).not.toContain('e_proj_other')
  })

  it('returns UNSUPPORTED when the linked evidenceId does not exist (cross-student guard)', () => {
    const c = validateProjectClaim({ id: 'p1', evidenceId: 'nonexistent_id' }, allEvidence)
    expect(c.status).toBe('UNSUPPORTED')
    expect(c.reason).toContain('not found')
  })
})

describe('evidence-validation.ts — validateAssessmentClaim (P2 fix)', () => {
  const allEvidence: EvidenceWithSkills[] = [
    { id: 'a1', status: 'VERIFIED', type: 'assessment', skills: [] } as unknown as EvidenceWithSkills,
    { id: 'a2', status: 'PENDING_REVIEW', type: 'assessment', skills: [] } as unknown as EvidenceWithSkills,
    { id: 'a3', status: 'VERIFIED', type: 'project', skills: [] } as unknown as EvidenceWithSkills, // WRONG TYPE
  ]

  it('returns UNSUPPORTED when assessment result has no linked evidenceId', () => {
    const c = validateAssessmentClaim(
      { id: 'r1', evidenceId: null, assessmentId: 'a', studentId: 's', score: 80, date: new Date() } as never,
      allEvidence,
    )
    expect(c.status).toBe('UNSUPPORTED')
  })

  it('returns SUPPORTED when linked VERIFIED assessment-type evidence exists', () => {
    const c = validateAssessmentClaim(
      { id: 'r1', evidenceId: 'a1', assessmentId: 'a', studentId: 's', score: 80, date: new Date() } as never,
      allEvidence,
    )
    expect(c.status).toBe('SUPPORTED')
    expect(c.evidenceIds).toEqual(['a1'])
  })

  it('returns NEEDS_REVIEW when linked evidence is pending', () => {
    const c = validateAssessmentClaim(
      { id: 'r2', evidenceId: 'a2', assessmentId: 'a', studentId: 's', score: 70, date: new Date() } as never,
      allEvidence,
    )
    expect(c.status).toBe('NEEDS_REVIEW')
  })

  it('returns UNSUPPORTED when linked evidence is of wrong type (project, not assessment)', () => {
    // SECURITY (P2 fix): previously an assessment was marked SUPPORTED just
    // because an evidenceId was present. Now we require the evidence to be
    // of type 'assessment'.
    const c = validateAssessmentClaim(
      { id: 'r3', evidenceId: 'a3', assessmentId: 'a', studentId: 's', score: 90, date: new Date() } as never,
      allEvidence,
    )
    expect(c.status).toBe('UNSUPPORTED')
    expect(c.reason).toContain('not "assessment"')
  })

  it('returns UNSUPPORTED when the linked evidenceId does not exist', () => {
    const c = validateAssessmentClaim(
      { id: 'r4', evidenceId: 'nonexistent', assessmentId: 'a', studentId: 's', score: 50, date: new Date() } as never,
      allEvidence,
    )
    expect(c.status).toBe('UNSUPPORTED')
  })
})

describe('evidence-validation.ts — validateCertificationClaim', () => {
  it('returns SUPPORTED for a verified certification', () => {
    const c = validateCertificationClaim({ id: 'c1', status: 'VERIFIED', skills: [] } as unknown as EvidenceWithSkills)
    expect(c.status).toBe('SUPPORTED')
  })
  it('returns NEEDS_REVIEW for a pending certification', () => {
    const c = validateCertificationClaim({ id: 'c2', status: 'PENDING_REVIEW', skills: [] } as unknown as EvidenceWithSkills)
    expect(c.status).toBe('NEEDS_REVIEW')
  })
  it('returns UNSUPPORTED for a rejected certification', () => {
    const c = validateCertificationClaim({ id: 'c3', status: 'REJECTED', skills: [] } as unknown as EvidenceWithSkills)
    expect(c.status).toBe('UNSUPPORTED')
  })
})

describe('evidence-validation.ts — filterOwnedEvidenceIds (cross-student guard)', () => {
  it('drops evidence IDs not in the student-owned set', () => {
    const requested = ['own1', 'own2', 'foreign1', 'own3', 'foreign2']
    const owned = new Set(['own1', 'own2', 'own3'])
    const filtered = filterOwnedEvidenceIds(requested, owned)
    expect(filtered).toEqual(['own1', 'own2', 'own3'])
  })
  it('returns empty when none of the requested IDs are owned', () => {
    const requested = ['foreign1', 'foreign2']
    const owned = new Set(['own1'])
    expect(filterOwnedEvidenceIds(requested, owned)).toEqual([])
  })
})
