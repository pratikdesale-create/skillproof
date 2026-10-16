import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { errorResponse, ResponseError } from '@/lib/auth'
import { requireUser, requireStudentProfileId } from '@/lib/api-helpers'

// GET /api/resumes/[id]/validate — owner student. Return claim validation:
// list each bullet with claimStatus, evidenceIds, missingEvidence notes.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser(req)
    const spId = await requireStudentProfileId(user)
    const { id } = await params

    const resume = await db.resume.findUnique({
      where: { id },
      include: { bullets: { orderBy: { orderIndex: 'asc' } } },
    })
    if (!resume) throw new ResponseError(404, 'Resume not found')
    if (resume.studentId !== spId) throw new ResponseError(403, 'Not your resume')

    // Collect all evidence IDs and load them
    const evidenceIds = new Set<string>()
    for (const b of resume.bullets) {
      if (b.evidenceIds) {
        try {
          const arr = JSON.parse(b.evidenceIds) as string[]
          arr.forEach(eid => evidenceIds.add(eid))
        } catch { /* ignore */ }
      }
    }
    const evidenceRecords = await db.evidence.findMany({
      where: { id: { in: Array.from(evidenceIds) } },
      select: { id: true, title: true, type: true, status: true, sourceUrl: true, organization: true },
    })
    const evidenceMap = new Map(evidenceRecords.map(e => [e.id, e]))

    const bullets = resume.bullets.map(b => {
      const evidenceIdsArr: string[] = b.evidenceIds ? JSON.parse(b.evidenceIds) : []
      const skillIdsArr: string[] = b.skillIds ? JSON.parse(b.skillIds) : []
      const evidence = evidenceIdsArr
        .map(eid => evidenceMap.get(eid))
        .filter(Boolean) as typeof evidenceRecords

      // Compute missing-evidence note
      let missingEvidenceNote: string | null = null
      if (b.claimStatus === 'UNSUPPORTED') {
        if (b.section === 'skills') {
          missingEvidenceNote = `No verified evidence for skill(s): ${skillIdsArr.join(', ')}`
        } else if (b.section === 'projects') {
          missingEvidenceNote = 'No linked project/github/demo_url evidence'
        } else if (b.section === 'certifications') {
          missingEvidenceNote = 'Certification evidence not verified'
        } else if (b.section === 'experience') {
          missingEvidenceNote = 'No linked assessment evidence'
        } else {
          missingEvidenceNote = 'No supporting evidence attached'
        }
      } else if (b.claimStatus === 'NEEDS_REVIEW') {
        missingEvidenceNote = 'Evidence pending review'
      }

      // Check if any linked evidence is in a non-verified status
      const unverifiedEvidence = evidence.filter(e => e.status !== 'VERIFIED')
      const unverifiedNote = unverifiedEvidence.length > 0
        ? `${unverifiedEvidence.length} linked evidence item(s) not yet verified`
        : null

      return {
        id: b.id,
        section: b.section,
        text: b.text,
        claimStatus: b.claimStatus,
        skillIds: skillIdsArr,
        evidenceIds: evidenceIdsArr,
        evidence: evidence.map(e => ({
          id: e.id,
          title: e.title,
          type: e.type,
          status: e.status,
          sourceUrl: e.sourceUrl,
          organization: e.organization,
        })),
        missingEvidenceNote,
        unverifiedEvidenceNote: unverifiedNote,
      }
    })

    const summary = {
      totalBullets: bullets.length,
      supported: bullets.filter(b => b.claimStatus === 'SUPPORTED').length,
      unsupported: bullets.filter(b => b.claimStatus === 'UNSUPPORTED').length,
      needsReview: bullets.filter(b => b.claimStatus === 'NEEDS_REVIEW').length,
      unverifiedEvidenceCount: bullets.reduce(
        (acc, b) => acc + b.evidence.filter(e => e.status !== 'VERIFIED').length,
        0
      ),
    }

    return Response.json({
      resumeId: id,
      title: resume.title,
      summary,
      bullets,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
