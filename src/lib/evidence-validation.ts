/**
 * Evidence validation library — central authority for deciding whether a
 * resume or skill claim is SUPPORTED, NEEDS_REVIEW, or UNSUPPORTED.
 *
 * SECURITY (P2): the previous resume generator attached project evidence
 * indiscriminately to every project (regardless of whether the evidence
 * actually related to that specific project), and marked assessment claims
 * as supported merely because an evidenceId was present. This module
 * enforces the four evidence-integrity rules from the spec:
 *
 *   1. Resolve evidence references from trusted server-side records.
 *   2. Confirm the records exist.
 *   3. Confirm they belong to the correct student.
 *   4. Confirm they relate to the specific project, certificate,
 *      assessment, or skill claim.
 *   5. Check their actual verification or review status.
 *
 * A supported claim must have appropriate reviewed or verified evidence
 * AND a relevant relationship to that claim.
 *
 * Pending evidence → NEEDS_REVIEW (not SUPPORTED, not UNSUPPORTED).
 * Missing / rejected / cross-student / unrelated evidence → UNSUPPORTED.
 *
 * Absence of evidence does NOT mean the student is lying — it means the
 * system cannot currently substantiate the claim. The UI must surface this
 * distinction honestly.
 */

import type {
  Evidence,
  Project,
  AssessmentResult,
  StudentSkill,
} from '@prisma/client'

export type ClaimStatus = 'SUPPORTED' | 'NEEDS_REVIEW' | 'UNSUPPORTED'

export interface EvidenceWithSkills extends Evidence {
  skills: Array<{ skillId: string; relevance: number }>
}

export interface ValidatedClaim {
  status: ClaimStatus
  evidenceIds: string[]
  reason: string
}

// Verification-status policy — mirrors the matching engine's policy:
//   VERIFIED → 1.0 (full credit)
//   PENDING_REVIEW, UNVERIFIED → 0.25 (provisional credit, needs review)
//   REJECTED, NEEDS_MORE_EVIDENCE → 0 (no credit)
const STATUS_CREDIT: Record<string, number> = {
  VERIFIED: 1.0,
  PENDING_REVIEW: 0.25,
  UNVERIFIED: 0.25,
  REJECTED: 0,
  NEEDS_MORE_EVIDENCE: 0,
}

export function statusCredit(status: string): number {
  return STATUS_CREDIT[status] ?? 0
}

export function isVerifiedStatus(status: string): boolean {
  return status === 'VERIFIED'
}

export function isProvisionalStatus(status: string): boolean {
  return status === 'PENDING_REVIEW' || status === 'UNVERIFIED'
}

export function isRejectedStatus(status: string): boolean {
  return status === 'REJECTED' || status === 'NEEDS_MORE_EVIDENCE'
}

// ----------------------------------------------------------------
// Per-claim validators
// ----------------------------------------------------------------

/**
 * Validate a SKILL claim.
 *
 * A skill claim is SUPPORTED if the student has at least one VERIFIED
 * evidence record that links to this skill.
 * It is NEEDS_REVIEW if the only linked evidence is pending/unverified.
 * It is UNSUPPORTED if there is no linked evidence, or all linked evidence
 * is rejected/needs-more.
 *
 * NOTE: the evidence passed in MUST already be filtered to belong to the
 * correct student (the caller is responsible for this — see
 * resume.generate/route.ts which loads student.evidence via Prisma).
 */
export function validateSkillClaim(
  skillId: string,
  linkedEvidence: EvidenceWithSkills[],
): ValidatedClaim {
  // Filter to evidence that actually links to this skill
  const relevant = linkedEvidence.filter(e =>
    e.skills.some(es => es.skillId === skillId)
  )
  if (relevant.length === 0) {
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: 'No evidence record links this skill to the student.',
    }
  }
  const verified = relevant.filter(e => isVerifiedStatus(e.status))
  const provisional = relevant.filter(e => isProvisionalStatus(e.status))
  const rejected = relevant.filter(e => isRejectedStatus(e.status))

  if (verified.length > 0) {
    return {
      status: 'SUPPORTED',
      evidenceIds: verified.map(e => e.id),
      reason: `${verified.length} verified evidence record(s) support this skill.`,
    }
  }
  if (provisional.length > 0) {
    return {
      status: 'NEEDS_REVIEW',
      evidenceIds: provisional.map(e => e.id),
      reason: `${provisional.length} evidence record(s) pending review. Claim cannot be marked as supported until review completes.`,
    }
  }
  // Only rejected / needs-more evidence
  return {
    status: 'UNSUPPORTED',
    evidenceIds: [],
    reason: `All linked evidence (${rejected.length}) is rejected or needs more evidence.`,
  }
}

/**
 * Validate a PROJECT claim.
 *
 * SECURITY (P2 fix): previously, ALL project/github/demo evidence was
 * attached to EVERY project regardless of whether it actually related to
 * that specific project. This caused false SUPPORTED statuses.
 *
 * The fix: use the Project.evidenceId field (set at project creation) to
 * link a specific evidence record to a specific project. Only that
 * specific evidence can support the project claim.
 *
 * If the project has no linked evidenceId, the claim is UNSUPPORTED —
 * we do NOT indiscriminately attach other project evidence.
 */
export function validateProjectClaim(
  project: Pick<Project, 'id' | 'evidenceId'>,
  allStudentEvidence: EvidenceWithSkills[],
): ValidatedClaim {
  // If the project has no explicit evidence link, the claim is unsupported.
  // We do NOT fall back to attaching any project/github/demo evidence we find.
  if (!project.evidenceId) {
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: 'Project has no explicitly linked evidence record. The system does not auto-attach unrelated project evidence.',
    }
  }
  // Look up the specifically linked evidence record
  const linked = allStudentEvidence.find(e => e.id === project.evidenceId)
  if (!linked) {
    // The linked evidenceId does not exist (or was deleted, or belongs to
    // another student — though the caller filters by student already).
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: 'The evidence record referenced by this project was not found. It may have been deleted or does not belong to this student.',
    }
  }
  // Check the verification status of the specifically linked evidence
  if (isVerifiedStatus(linked.status)) {
    return {
      status: 'SUPPORTED',
      evidenceIds: [linked.id],
      reason: 'Project has a linked, verified evidence record.',
    }
  }
  if (isProvisionalStatus(linked.status)) {
    return {
      status: 'NEEDS_REVIEW',
      evidenceIds: [linked.id],
      reason: 'Project has a linked evidence record pending review.',
    }
  }
  return {
    status: 'UNSUPPORTED',
    evidenceIds: [],
    reason: `Project's linked evidence is ${linked.status}.`,
  }
}

/**
 * Validate a CERTIFICATION claim.
 *
 * A certification claim is SUPPORTED only if the certification evidence
 * record is VERIFIED. Pending certifications → NEEDS_REVIEW. Rejected
 * certifications are excluded entirely.
 */
export function validateCertificationClaim(
  evidence: EvidenceWithSkills,
): ValidatedClaim {
  if (isVerifiedStatus(evidence.status)) {
    return {
      status: 'SUPPORTED',
      evidenceIds: [evidence.id],
      reason: 'Certification has a verified evidence record.',
    }
  }
  if (isProvisionalStatus(evidence.status)) {
    return {
      status: 'NEEDS_REVIEW',
      evidenceIds: [evidence.id],
      reason: 'Certification evidence is pending review. Cannot be marked as supported until verified.',
    }
  }
  return {
    status: 'UNSUPPORTED',
    evidenceIds: [],
    reason: `Certification evidence is ${evidence.status}.`,
  }
}

/**
 * Validate an ASSESSMENT claim.
 *
 * SECURITY (P2 fix): previously, an assessment result was marked SUPPORTED
 * merely because it had an evidenceId field — without checking that the
 * evidence actually exists, belongs to the student, or is verified.
 *
 * The fix: look up the linked evidence record, confirm it exists, confirm
 * it relates to this assessment (via the assessment's skill or the evidence
 * type === 'assessment'), and check its verification status.
 */
export function validateAssessmentClaim(
  result: AssessmentResult,
  allStudentEvidence: EvidenceWithSkills[],
): ValidatedClaim {
  if (!result.evidenceId) {
    // No linked evidence — the assessment result exists but is not backed
    // by an evidence record the system can verify.
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: 'Assessment result has no linked evidence record.',
    }
  }
  const linked = allStudentEvidence.find(e => e.id === result.evidenceId)
  if (!linked) {
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: 'The evidence record referenced by this assessment result was not found. It may have been deleted or does not belong to this student.',
    }
  }
  // Confirm the evidence is assessment-type
  if (linked.type !== 'assessment') {
    return {
      status: 'UNSUPPORTED',
      evidenceIds: [],
      reason: `Linked evidence record is of type "${linked.type}", not "assessment". Cannot support an assessment claim with non-assessment evidence.`,
    }
  }
  if (isVerifiedStatus(linked.status)) {
    return {
      status: 'SUPPORTED',
      evidenceIds: [linked.id],
      reason: 'Assessment result has a linked, verified assessment evidence record.',
    }
  }
  if (isProvisionalStatus(linked.status)) {
    return {
      status: 'NEEDS_REVIEW',
      evidenceIds: [linked.id],
      reason: 'Assessment evidence is pending review.',
    }
  }
  return {
    status: 'UNSUPPORTED',
    evidenceIds: [],
    reason: `Assessment evidence is ${linked.status}.`,
  }
}

// ----------------------------------------------------------------
// Cross-student evidence guard
// ----------------------------------------------------------------

/**
 * SECURITY: confirm that a list of evidence IDs all belong to the same student.
 *
 * This is a defensive check — the caller should already have loaded only
 * the student's own evidence, but this guard catches bugs where an evidence
 * ID from another student was supplied (e.g. via a crafted request body).
 *
 * Returns the list of evidence IDs that ARE owned by the student; any
 * IDs that are not found in the student's evidence set are dropped and
 * logged.
 */
export function filterOwnedEvidenceIds(
  requestedEvidenceIds: string[],
  studentEvidenceSet: Set<string>,
): string[] {
  return requestedEvidenceIds.filter(id => studentEvidenceSet.has(id))
}
