/**
 * Server-side PDF resume generator for Placement Hub.
 *
 * Generates an ATS-friendly one-page (multi-page when necessary) PDF using
 * jsPDF. Pure server-side — no browser-only APIs (window, document).
 *
 * Public API:
 *   generateResumePdf(resumeId: string) -> { buffer: Buffer; filename: string }
 */

import { jsPDF } from 'jspdf'
import { db } from '@/lib/db'
import { safeParseJson } from '@/lib/api-helpers'

// ---- Page geometry (US Letter portrait, points) -----------------------------
const PAGE_WIDTH = 612 // 8.5in × 72
const PAGE_HEIGHT = 792 // 11in × 72
const MARGIN = 36 // 0.5in
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN // 540pt
const FOOTER_HEIGHT = 24 // reserved footer band

// ---- Color palette (subtle, ATS-friendly grays) -----------------------------
const COLOR_TEXT: [number, number, number] = [25, 25, 25] // near-black
const COLOR_MUTED: [number, number, number] = [90, 90, 90] // gray-600-ish
const COLOR_RULE: [number, number, number] = [180, 180, 180] // rule line gray
const COLOR_UNSUPPORTED: [number, number, number] = [150, 60, 60] // muted red

// ---- Types -------------------------------------------------------------------
type EvidenceRef = { id: string; title: string; type: string | null; status: string | null }
type SkillRef = { id: string; displayName: string }

interface LoadedResumeData {
  resumeId: string
  title: string
  version: number
  jobId: string | null
  jobTitle: string | null
  summary: string | null
  // Student / contact
  studentName: string
  email: string | null
  phone: string | null
  location: string | null
  linkedinUrl: string | null
  githubUser: string | null
  portfolioUrl: string | null
  // Education rows (from DB, not from bullets — bullets also encode education text)
  educationRows: Array<{
    degree: string
    institution: string
    startYear: number
    endYear: number
    score: number | null
    scoreType: string | null
    field: string | null
  }>
  bullets: Array<{
    id: string
    section: string
    text: string
    skillIds: string[]
    evidenceIds: string[]
    claimStatus: string
    orderIndex: number
  }>
  evidenceMap: Map<string, EvidenceRef>
  skillMap: Map<string, SkillRef>
}

// ---- Helpers -----------------------------------------------------------------

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      // strip combining marks (accents etc.)
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 80) || 'resume'
  )
}

/** Strip the inline " [Unverified]" marker that the generate route appends. */
function stripInlineUnverified(text: string): string {
  return text.replace(/\s*\[Unverified\]\s*$/i, '').replace(/\s*\[Unverified\]\s*/g, ' ').trim()
}

/** Decode any JSON-encoded string-array field (skillIds / evidenceIds). */
function decodeStringArray(raw: string | null | undefined): string[] {
  const parsed = safeParseJson<string[]>(raw, [])
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
}

/** Build a contact line from available fields. */
function buildContactLine(d: LoadedResumeData): string {
  const parts: string[] = []
  if (d.email) parts.push(d.email)
  if (d.phone) parts.push(d.phone)
  if (d.location) parts.push(d.location)
  if (d.portfolioUrl) parts.push(d.portfolioUrl)
  else if (d.githubUser) {
    parts.push(`github.com/${d.githubUser}`)
  }
  if (d.linkedinUrl) parts.push(d.linkedinUrl)
  return parts.join('  •  ')
}

// ---- Loader ------------------------------------------------------------------

async function loadResumeData(resumeId: string): Promise<LoadedResumeData> {
  const resume = await db.resume.findUnique({
    where: { id: resumeId },
    include: {
      bullets: { orderBy: { orderIndex: 'asc' } },
      job: { select: { id: true, title: true } },
      student: {
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
          education: { orderBy: { startYear: 'desc' } },
        },
      },
    },
  })
  if (!resume) {
    throw new Error(`Resume ${resumeId} not found`)
  }

  // Decode bullets once
  const bullets = resume.bullets.map(b => ({
    id: b.id,
    section: b.section,
    text: b.text,
    skillIds: decodeStringArray(b.skillIds),
    evidenceIds: decodeStringArray(b.evidenceIds),
    claimStatus: b.claimStatus,
    orderIndex: b.orderIndex,
  }))

  // Aggregate evidence + skill ids referenced anywhere in bullets
  const evidenceIds = new Set<string>()
  const skillIds = new Set<string>()
  for (const b of bullets) {
    for (const eid of b.evidenceIds) evidenceIds.add(eid)
    for (const sid of b.skillIds) skillIds.add(sid)
  }
  // Also include skill-section bullets' skillIds explicitly (already done above)

  type EvidenceRow = { id: string; title: string; type: string; status: string }
  type SkillRow = { id: string; displayName: string }

  const evidenceRows: EvidenceRow[] =
    evidenceIds.size === 0
      ? []
      : await db.evidence.findMany({
          where: { id: { in: Array.from(evidenceIds) } },
          select: { id: true, title: true, type: true, status: true },
        })
  const skillRows: SkillRow[] =
    skillIds.size === 0
      ? []
      : await db.skill.findMany({
          where: { id: { in: Array.from(skillIds) } },
          select: { id: true, displayName: true },
        })

  const evidenceEntries: Array<[string, EvidenceRef]> = evidenceRows.map(e => [
    e.id,
    { id: e.id, title: e.title, type: e.type, status: e.status },
  ])
  const evidenceMap = new Map<string, EvidenceRef>(evidenceEntries)

  const skillEntries: Array<[string, SkillRef]> = skillRows.map(s => [
    s.id,
    { id: s.id, displayName: s.displayName },
  ])
  const skillMap = new Map<string, SkillRef>(skillEntries)

  return {
    resumeId: resume.id,
    title: resume.title,
    version: resume.version,
    jobId: resume.jobId,
    jobTitle: resume.job?.title ?? null,
    summary: resume.summary,
    studentName: resume.student.user.name,
    email: resume.student.user.email,
    phone: resume.student.user.phone,
    location: resume.student.location,
    linkedinUrl: resume.student.linkedinUrl,
    githubUser: resume.student.githubUser,
    portfolioUrl: resume.student.portfolioUrl,
    educationRows: resume.student.education.map(ed => ({
      degree: ed.degree,
      institution: ed.institution,
      startYear: ed.startYear,
      endYear: ed.endYear,
      score: ed.score,
      scoreType: ed.scoreType,
      field: ed.field,
    })),
    bullets,
    evidenceMap,
    skillMap,
  }
}

// ---- PDF layout state --------------------------------------------------------

interface PdfState {
  doc: jsPDF
  y: number
  page: number
}

/** Ensure vertical space; if not, add a new page. */
function ensureSpace(s: PdfState, needed: number) {
  if (s.y + needed > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT) {
    s.doc.addPage()
    s.page += 1
    s.y = MARGIN
  }
}

/** Draw a horizontal rule under the current y position. */
function drawRule(s: PdfState) {
  const ruleY = s.y + 2
  s.doc.setDrawColor(...COLOR_RULE)
  s.doc.setLineWidth(0.5)
  s.doc.line(MARGIN, ruleY, PAGE_WIDTH - MARGIN, ruleY)
  s.y = ruleY + 6
}

/** Render a section heading and advance y. */
function renderSectionHeading(s: PdfState, title: string) {
  ensureSpace(s, 22)
  s.doc.setFont('helvetica', 'bold')
  s.doc.setFontSize(12)
  s.doc.setTextColor(...COLOR_TEXT)
  s.doc.text(title.toUpperCase(), MARGIN, s.y + 10)
  s.y += 14
  drawRule(s)
}

/** Render a paragraph (wrapped). */
function renderParagraph(s: PdfState, text: string, opts?: { size?: number; color?: [number, number, number]; italic?: boolean; indent?: number; gapAfter?: number }) {
  const size = opts?.size ?? 10
  const color = opts?.color ?? COLOR_TEXT
  const italic = opts?.italic ?? false
  const indent = opts?.indent ?? 0
  const gapAfter = opts?.gapAfter ?? 4
  const font = italic ? 'italic' : 'normal'
  s.doc.setFont('helvetica', font)
  s.doc.setFontSize(size)
  s.doc.setTextColor(...color)
  const maxWidth = CONTENT_WIDTH - indent
  const lines: string[] = s.doc.splitTextToSize(text, maxWidth)
  const lineHeight = size * 1.3
  for (const line of lines) {
    ensureSpace(s, lineHeight)
    s.doc.text(line, MARGIN + indent, s.y + size)
    s.y += lineHeight
  }
  s.y += gapAfter
}

/** Render a bullet line (with hanging indent). */
function renderBullet(s: PdfState, text: string, opts?: { unsupported?: boolean; subLines?: string[] }) {
  const size = 10
  const color = opts?.unsupported ? COLOR_UNSUPPORTED : COLOR_TEXT
  const bulletChar = '•'
  const indent = 14
  const hangingIndent = 18
  s.doc.setFont('helvetica', 'normal')
  s.doc.setFontSize(size)
  s.doc.setTextColor(...color)
  const marker = opts?.unsupported ? ' (Unverified)' : ''
  const fullText = `${text}${marker}`
  const maxWidth = CONTENT_WIDTH - hangingIndent
  const lines: string[] = s.doc.splitTextToSize(fullText, maxWidth)
  const lineHeight = size * 1.3
  const blockHeight = lines.length * lineHeight + (opts?.subLines?.length ? opts.subLines.length * (size - 1) * 1.3 : 0) + 2
  ensureSpace(s, blockHeight)
  // First line with bullet marker
  s.doc.text(bulletChar, MARGIN + indent * 0.25, s.y + size)
  s.doc.text(lines[0], MARGIN + indent, s.y + size)
  s.y += lineHeight
  // Wrap lines (if any) — hang under text start
  for (let i = 1; i < lines.length; i++) {
    s.doc.text(lines[i], MARGIN + indent, s.y + size)
    s.y += lineHeight
  }
  // Sub-lines (e.g. "Evidence: <title>" indented further, italic muted)
  if (opts?.subLines && opts.subLines.length > 0) {
    s.doc.setFont('helvetica', 'italic')
    s.doc.setFontSize(size - 1)
    s.doc.setTextColor(...COLOR_MUTED)
    for (const sub of opts.subLines) {
      const subLines: string[] = s.doc.splitTextToSize(sub, CONTENT_WIDTH - hangingIndent - 14)
      for (const ln of subLines) {
        s.doc.text(ln, MARGIN + indent + 10, s.y + (size - 1))
        s.y += (size - 1) * 1.3
      }
    }
    s.y += 2
  }
  s.y += 2
}

// ---- Main PDF builder --------------------------------------------------------

function buildPdf(d: LoadedResumeData): { buffer: Buffer; filename: string } {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
    compress: true,
  })
  doc.setDocumentProperties({
    title: `${d.studentName} — Resume`,
    subject: d.title,
    author: 'Placement Hub',
    creator: 'Placement Hub (resume-algorithm v1.0)',
  })

  const state: PdfState = { doc, y: MARGIN, page: 1 }

  // ---- HEADER: name (large) + contact line ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLOR_TEXT)
  doc.text(d.studentName || 'Student', MARGIN, state.y + 20)
  state.y += 26

  const contactLine = buildContactLine(d)
  if (contactLine) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...COLOR_MUTED)
    const contactLines: string[] = doc.splitTextToSize(contactLine, CONTENT_WIDTH)
    for (const ln of contactLines) {
      doc.text(ln, MARGIN, state.y + 9)
      state.y += 12
    }
  }
  state.y += 4
  drawRule(state)

  // ---- SECTION: Professional Summary ----
  if (d.summary && d.summary.trim()) {
    renderSectionHeading(state, 'Professional Summary')
    renderParagraph(state, d.summary.trim(), { size: 10, gapAfter: 6 })
  }

  // ---- SECTION: Education (prefer structured rows; fallback to education bullets) ----
  // We have structured educationRows; if empty, we can also use bullets with section 'education'
  const educationBullets = d.bullets.filter(b => b.section === 'education')
  const hasStructured = d.educationRows.length > 0
  if (hasStructured || educationBullets.length > 0) {
    renderSectionHeading(state, 'Education')
    if (hasStructured) {
      for (const ed of d.educationRows) {
        const scorePart = ed.score != null ? `${ed.score}${ed.scoreType ? ' ' + ed.scoreType : ''}` : 'N/A'
        const line = `${ed.degree}${ed.field ? ', ' + ed.field : ''} — ${ed.institution} (${ed.startYear}–${ed.endYear}) — ${scorePart}`
        renderBullet(state, line)
      }
    } else {
      for (const b of educationBullets) {
        renderBullet(state, stripInlineUnverified(b.text), { unsupported: b.claimStatus === 'UNSUPPORTED' })
      }
    }
  }

  // ---- SECTION: Technical Skills (aggregate from skill-section bullets' skillIds) ----
  const skillsBullets = d.bullets.filter(b => b.section === 'skills')
  if (skillsBullets.length > 0) {
    renderSectionHeading(state, 'Technical Skills')
    // Map skillIds → displayNames (de-dup, preserve first-seen order)
    const seen = new Set<string>()
    const displayNames: string[] = []
    for (const b of skillsBullets) {
      for (const sid of b.skillIds) {
        if (seen.has(sid)) continue
        seen.add(sid)
        const sk = d.skillMap.get(sid)
        displayNames.push(sk?.displayName ?? sid)
      }
    }
    // Also include the bullet text as a fallback if no skillIds were captured
    if (displayNames.length === 0) {
      const text = skillsBullets.map(b => stripInlineUnverified(b.text)).join(' • ')
      renderParagraph(state, text, { size: 10, gapAfter: 6 })
    } else {
      const joined = displayNames.join(', ')
      renderParagraph(state, joined, { size: 10, gapAfter: 6 })
    }
  }

  // ---- SECTION: Projects ----
  const projectBullets = d.bullets.filter(b => b.section === 'projects')
  if (projectBullets.length > 0) {
    renderSectionHeading(state, 'Projects')
    for (const b of projectBullets) {
      const subLines: string[] = []
      const evTitles = b.evidenceIds
        .map(eid => d.evidenceMap.get(eid))
        .filter(Boolean)
        .map(e => `Evidence: ${e!.title}${e!.status && e!.status !== 'VERIFIED' ? ` [${e!.status}]` : ''}`)
      if (evTitles.length > 0) subLines.push(...evTitles)
      renderBullet(state, stripInlineUnverified(b.text), {
        unsupported: b.claimStatus === 'UNSUPPORTED',
        subLines,
      })
    }
  }

  // ---- SECTION: Experience & Achievements (experience + certifications) ----
  const expBullets = d.bullets.filter(b => b.section === 'experience' || b.section === 'certifications')
  if (expBullets.length > 0) {
    renderSectionHeading(state, 'Experience & Achievements')
    for (const b of expBullets) {
      const subLines: string[] = []
      const evTitles = b.evidenceIds
        .map(eid => d.evidenceMap.get(eid))
        .filter(Boolean)
        .map(e => `Evidence: ${e!.title}${e!.status && e!.status !== 'VERIFIED' ? ` [${e!.status}]` : ''}`)
      if (evTitles.length > 0) subLines.push(...evTitles)
      renderBullet(state, stripInlineUnverified(b.text), {
        unsupported: b.claimStatus === 'UNSUPPORTED',
        subLines,
      })
    }
  }

  // ---- FOOTER on every page ----
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLOR_MUTED)
    const footerText = 'Generated by Placement Hub  •  Evidence-backed resume  •  Algorithm v1.0'
    const pageLabel = `Page ${p} of ${totalPages}`
    // y measured from top; footer sits at PAGE_HEIGHT - MARGIN
    const footerY = PAGE_HEIGHT - MARGIN + 8
    doc.text(footerText, MARGIN, footerY)
    doc.text(pageLabel, PAGE_WIDTH - MARGIN, footerY, { align: 'right' })
    // Thin rule above the footer
    doc.setDrawColor(...COLOR_RULE)
    doc.setLineWidth(0.3)
    doc.line(MARGIN, PAGE_HEIGHT - MARGIN + 2, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - MARGIN + 2)
  }

  // ---- Output as Buffer ----
  const arrayBuffer = doc.output('arraybuffer')
  // Copy into a Node Buffer (the ArrayBuffer returned by jsPDF may be a SharedArrayBuffer
  // in some environments; Buffer.from handles both safely).
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer)

  // ---- Filename ----
  const studentSlug = slugify(d.studentName)
  const jobSlug = d.jobTitle ? slugify(d.jobTitle) : `v${d.version}`
  const filename = `${studentSlug}-resume-${jobSlug}.pdf`

  return { buffer, filename }
}

// ---- Public API --------------------------------------------------------------

/**
 * Generate a PDF for a resume.
 *
 * @param resumeId id of the Resume row
 * @returns { buffer: Buffer; filename: string }
 */
export async function generateResumePdf(
  resumeId: string
): Promise<{ buffer: Buffer; filename: string }> {
  const data = await loadResumeData(resumeId)
  return buildPdf(data)
}

export { buildPdf as _buildPdfForTest } // exported for potential debugging only
