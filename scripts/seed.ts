import { db } from '../src/lib/db'
import { hashPassword, createSessionToken } from '../src/lib/auth'
import { clearNormalizationCache } from '../src/lib/matching'

// Demo data for Placement Hub
// All credentials are clearly fake/synthetic for demonstration purposes only.

const DEMO_PASSWORD = 'demo1234'

const SKILLS_CATALOG: Array<{ canonical: string; display: string; category: string; aliases: string[] }> = [
  { canonical: 'javascript', display: 'JavaScript', category: 'language', aliases: ['js', 'ecmascript'] },
  { canonical: 'typescript', display: 'TypeScript', category: 'language', aliases: ['ts'] },
  { canonical: 'python', display: 'Python', category: 'language', aliases: ['py', 'python3'] },
  { canonical: 'react', display: 'React', category: 'framework', aliases: ['reactjs', 'react.js', 'react js'] },
  { canonical: 'angular', display: 'Angular', category: 'framework', aliases: ['angularjs', 'angular.js'] },
  { canonical: 'vue', display: 'Vue', category: 'framework', aliases: ['vuejs', 'vue.js'] },
  { canonical: 'next.js', display: 'Next.js', category: 'framework', aliases: ['nextjs', 'next js'] },
  { canonical: 'node.js', display: 'Node.js', category: 'framework', aliases: ['nodejs', 'node', 'node js'] },
  { canonical: 'express', display: 'Express', category: 'framework', aliases: ['expressjs', 'express.js'] },
  { canonical: 'postgresql', display: 'PostgreSQL', category: 'database', aliases: ['postgres', 'postgres sql'] },
  { canonical: 'mongodb', display: 'MongoDB', category: 'database', aliases: ['mongo'] },
  { canonical: 'redis', display: 'Redis', category: 'database', aliases: ['redis cache'] },
  { canonical: 'mysql', display: 'MySQL', category: 'database', aliases: [] },
  { canonical: 'aws', display: 'AWS', category: 'cloud', aliases: ['amazon web services'] },
  { canonical: 'docker', display: 'Docker', category: 'tool', aliases: ['docker compose'] },
  { canonical: 'kubernetes', display: 'Kubernetes', category: 'tool', aliases: ['k8s'] },
  { canonical: 'c++', display: 'C++', category: 'language', aliases: ['c plus plus'] },
  { canonical: 'java', display: 'Java', category: 'language', aliases: [] },
  { canonical: 'go', display: 'Go', category: 'language', aliases: ['golang'] },
  { canonical: 'html', display: 'HTML', category: 'language', aliases: ['html5'] },
  { canonical: 'css', display: 'CSS', category: 'language', aliases: ['css3'] },
  { canonical: 'tailwind css', display: 'Tailwind CSS', category: 'framework', aliases: ['tailwind', 'tailwindcss'] },
  { canonical: 'graphql', display: 'GraphQL', category: 'api', aliases: ['graphql apis'] },
  { canonical: 'rest api', display: 'REST API', category: 'api', aliases: ['rest apis', 'restful api', 'restful'] },
  { canonical: 'machine learning', display: 'Machine Learning', category: 'ml', aliases: ['ml'] },
  { canonical: 'deep learning', display: 'Deep Learning', category: 'ml', aliases: ['dl'] },
  { canonical: 'natural language processing', display: 'Natural Language Processing', category: 'ml', aliases: ['nlp'] },
  { canonical: 'data structures', display: 'Data Structures', category: 'cs', aliases: ['dsa', 'data structures and algorithms'] },
  { canonical: 'algorithms', display: 'Algorithms', category: 'cs', aliases: [] },
  { canonical: 'git', display: 'Git', category: 'tool', aliases: [] },
  { canonical: 'ci/cd', display: 'CI/CD', category: 'tool', aliases: ['continuous integration'] },
  { canonical: 'system design', display: 'System Design', category: 'cs', aliases: [] },
  { canonical: 'communication', display: 'Communication', category: 'soft', aliases: [] },
  { canonical: 'leadership', display: 'Leadership', category: 'soft', aliases: [] },
]

const COMPANIES = [
  { name: 'Northwind Tech', industry: 'Software', website: 'https://example.com/northwind', contactName: 'Anjali Rao', contactEmail: 'anjali.rao@northwind.example' },
  { name: 'Quantum Labs', industry: 'AI/ML', website: 'https://example.com/quantum', contactName: 'Dev Patel', contactEmail: 'dev.patel@quantum.example' },
  { name: 'Helix Cloud', industry: 'Cloud Infrastructure', website: 'https://example.com/helix', contactName: 'Maya Iyer', contactEmail: 'maya.iyer@helix.example' },
  { name: 'BrightPath Fintech', industry: 'FinTech', website: 'https://example.com/brightpath', contactName: 'Karan Sethi', contactEmail: 'karan.sethi@brightpath.example' },
  { name: 'Orbit Robotics', industry: 'Robotics', website: 'https://example.com/orbit', contactName: 'Leena Bose', contactEmail: 'leena.bose@orbit.example' },
  { name: 'Verdant Health', industry: 'HealthTech', website: 'https://example.com/verdant', contactName: 'Arjun Nair', contactEmail: 'arjun.nair@verdant.example' },
]

const STUDENT_DATA = [
  {
    name: 'Aarav Sharma', email: 'aarav.sharma@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.7, location: 'Bengaluru', githubUser: 'aaravsharma', bio: 'Full-stack developer passionate about web platforms and developer tools.',
    skills: [
      { name: 'javascript', level: 'advanced' },
      { name: 'typescript', level: 'advanced' },
      { name: 'react', level: 'advanced' },
      { name: 'node.js', level: 'intermediate' },
      { name: 'postgresql', level: 'intermediate' },
      { name: 'docker', level: 'beginner' },
      { name: 'aws', level: 'beginner' },
    ],
  },
  {
    name: 'Diya Iyer', email: 'diya.iyer@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 9.1, location: 'Mumbai', githubUser: 'diyaiyer', bio: 'ML enthusiast. Built computer vision demos and NLP classifiers.',
    skills: [
      { name: 'python', level: 'advanced' },
      { name: 'machine learning', level: 'intermediate' },
      { name: 'deep learning', level: 'intermediate' },
      { name: 'natural language processing', level: 'intermediate' },
      { name: 'javascript', level: 'intermediate' },
      { name: 'react', level: 'beginner' },
    ],
  },
  {
    name: 'Kabir Khan', email: 'kabir.khan@demo.edu', branch: 'Information Technology', batch: '2022-2026',
    cgpa: 8.4, location: 'Hyderabad', githubUser: 'kabirkhan', bio: 'Backend engineer focused on distributed systems and APIs.',
    skills: [
      { name: 'java', level: 'advanced' },
      { name: 'go', level: 'intermediate' },
      { name: 'postgresql', level: 'advanced' },
      { name: 'redis', level: 'intermediate' },
      { name: 'docker', level: 'intermediate' },
      { name: 'kubernetes', level: 'beginner' },
      { name: 'system design', level: 'intermediate' },
    ],
  },
  {
    name: 'Meera Nair', email: 'meera.nair@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 9.3, location: 'Chennai', githubUser: 'meeranair', bio: 'Frontend specialist. Loves accessible UI and design systems.',
    skills: [
      { name: 'javascript', level: 'advanced' },
      { name: 'react', level: 'advanced' },
      { name: 'tailwind css', level: 'advanced' },
      { name: 'next.js', level: 'intermediate' },
      { name: 'html', level: 'advanced' },
      { name: 'css', level: 'advanced' },
    ],
  },
  {
    name: 'Rohan Verma', email: 'rohan.verma@demo.edu', branch: 'Electronics & Communication', batch: '2021-2025',
    cgpa: 8.2, location: 'Pune', githubUser: 'rohanverma', bio: 'Robotics + embedded systems. C++ and Rust tinkerer.',
    skills: [
      { name: 'c++', level: 'advanced' },
      { name: 'python', level: 'intermediate' },
      { name: 'machine learning', level: 'beginner' },
      { name: 'algorithms', level: 'intermediate' },
      { name: 'data structures', level: 'intermediate' },
    ],
  },
  {
    name: 'Sana Reddy', email: 'sana.reddy@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.9, location: 'Bengaluru', githubUser: 'sanareddy', bio: 'Data engineer. Loves pipelines, SQL and observability.',
    skills: [
      { name: 'python', level: 'advanced' },
      { name: 'postgresql', level: 'advanced' },
      { name: 'mysql', level: 'intermediate' },
      { name: 'aws', level: 'intermediate' },
      { name: 'docker', level: 'intermediate' },
      { name: 'ci/cd', level: 'beginner' },
    ],
  },
  {
    name: 'Vikram Desai', email: 'vikram.desai@demo.edu', branch: 'Information Technology', batch: '2022-2026',
    cgpa: 7.9, location: 'Ahmedabad', githubUser: 'vikramdesai', bio: 'Full-stack tinkerer. Shipping side projects.',
    skills: [
      { name: 'javascript', level: 'intermediate' },
      { name: 'node.js', level: 'intermediate' },
      { name: 'react', level: 'intermediate' },
      { name: 'mongodb', level: 'intermediate' },
      { name: 'express', level: 'intermediate' },
    ],
  },
  {
    name: 'Ananya Bose', email: 'ananya.bose@demo.edu', branch: 'Computer Science', batch: '2021-2025',
    cgpa: 9.0, location: 'Kolkata', githubUser: 'ananyabose', bio: 'Backend & cloud. Loves infrastructure as code.',
    skills: [
      { name: 'go', level: 'advanced' },
      { name: 'kubernetes', level: 'intermediate' },
      { name: 'docker', level: 'advanced' },
      { name: 'aws', level: 'advanced' },
      { name: 'system design', level: 'intermediate' },
      { name: 'postgresql', level: 'intermediate' },
    ],
  },
  {
    name: 'Karthik Rao', email: 'karthik.rao@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.6, location: 'Bengaluru', githubUser: 'karthikrao', bio: 'Mobile + web hybrid developer.',
    skills: [
      { name: 'javascript', level: 'advanced' },
      { name: 'react', level: 'advanced' },
      { name: 'node.js', level: 'intermediate' },
      { name: 'graphql', level: 'intermediate' },
      { name: 'postgresql', level: 'intermediate' },
    ],
  },
  {
    name: 'Ishita Gupta', email: 'ishita.gupta@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.8, location: 'Delhi', githubUser: 'ishitagupta', bio: 'AI/ML researcher. Published 2 papers in NLP.',
    skills: [
      { name: 'python', level: 'advanced' },
      { name: 'machine learning', level: 'advanced' },
      { name: 'natural language processing', level: 'advanced' },
      { name: 'deep learning', level: 'intermediate' },
    ],
  },
  {
    name: 'Aditya Joshi', email: 'aditya.joshi@demo.edu', branch: 'Information Technology', batch: '2022-2026',
    cgpa: 8.1, location: 'Nagpur', githubUser: 'adityajoshi', bio: 'DevOps enthusiast.',
    skills: [
      { name: 'docker', level: 'intermediate' },
      { name: 'kubernetes', level: 'beginner' },
      { name: 'ci/cd', level: 'intermediate' },
      { name: 'aws', level: 'intermediate' },
    ],
  },
  {
    name: 'Priya Menon', email: 'priya.menon@demo.edu', branch: 'Computer Science', batch: '2021-2025',
    cgpa: 9.4, location: 'Kochi', githubUser: 'priyamenon', bio: 'Backend + databases. Optimized query performance.',
    skills: [
      { name: 'java', level: 'advanced' },
      { name: 'postgresql', level: 'advanced' },
      { name: 'redis', level: 'intermediate' },
      { name: 'system design', level: 'intermediate' },
      { name: 'data structures', level: 'advanced' },
    ],
  },
  {
    name: 'Sahil Mehta', email: 'sahil.mehta@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 7.6, location: 'Surat', githubUser: 'sahilmehta', bio: 'Frontend + UX designer.',
    skills: [
      { name: 'react', level: 'intermediate' },
      { name: 'css', level: 'intermediate' },
      { name: 'tailwind css', level: 'intermediate' },
    ],
  },
  {
    name: 'Tanvi Bhatt', email: 'tanvi.bhatt@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.5, location: 'Indore', githubUser: 'tanvibhatt', bio: 'Full-stack with focus on testing and reliability.',
    skills: [
      { name: 'typescript', level: 'advanced' },
      { name: 'react', level: 'advanced' },
      { name: 'node.js', level: 'intermediate' },
      { name: 'postgresql', level: 'intermediate' },
    ],
  },
  {
    name: 'Yash Agarwal', email: 'yash.agarwal@demo.edu', branch: 'Information Technology', batch: '2021-2025',
    cgpa: 8.0, location: 'Lucknow', githubUser: 'yashagarwal', bio: 'Backend engineer. Loves Go and microservices.',
    skills: [
      { name: 'go', level: 'intermediate' },
      { name: 'docker', level: 'intermediate' },
      { name: 'kubernetes', level: 'beginner' },
      { name: 'postgresql', level: 'intermediate' },
      { name: 'rest api', level: 'intermediate' },
    ],
  },
  {
    name: 'Riya Kulkarni', email: 'riya.kulkarni@demo.edu', branch: 'Computer Science', batch: '2022-2026',
    cgpa: 8.3, location: 'Nashik', githubUser: 'riyakulkarni', bio: 'Mobile developer with React Native and Flutter.',
    skills: [
      { name: 'javascript', level: 'intermediate' },
      { name: 'react', level: 'intermediate' },
    ],
  },
]

const JOBS = [
  {
    title: 'Frontend Engineer', company: 'Northwind Tech',
    description: 'Build delightful web UIs with React and TypeScript. Collaborate with designers to ship accessible, performant interfaces. Optimize rendering, write tests, and own features end-to-end.',
    location: 'Bengaluru', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 800000, salaryMax: 1400000, batch: '2022-2026',
    required: ['javascript', 'typescript', 'react', 'html', 'css'],
    preferred: ['tailwind css', 'next.js'],
    sourceType: 'MANUAL',
  },
  {
    title: 'Backend Engineer', company: 'Northwind Tech',
    description: 'Design APIs and services with Node.js and PostgreSQL. Build scalable data models, write integration tests, and own production reliability.',
    location: 'Bengaluru', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 900000, salaryMax: 1600000, batch: '2022-2026',
    required: ['javascript', 'node.js', 'postgresql', 'rest api'],
    preferred: ['docker', 'redis', 'typescript'],
    sourceType: 'MANUAL',
  },
  {
    title: 'ML Engineer', company: 'Quantum Labs',
    description: 'Train and deploy ML models for NLP and computer vision tasks. Build data pipelines, evaluate models, and integrate them into products.',
    location: 'Remote (India)', workArrangement: 'remote', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 1000000, salaryMax: 1800000, batch: '2021-2025',
    required: ['python', 'machine learning', 'natural language processing'],
    preferred: ['deep learning', 'aws', 'docker'],
    sourceType: 'FEED', sourceUrl: 'https://careers.quantum.example/jobs/ml-engineer-2024',
  },
  {
    title: 'Cloud Infrastructure Engineer', company: 'Helix Cloud',
    description: 'Operate Kubernetes clusters, build CI/CD pipelines, automate everything. Strong focus on observability and reliability.',
    location: 'Hyderabad', workArrangement: 'onsite', employmentType: 'full-time',
    minExp: 0, maxExp: 3, salaryMin: 1100000, salaryMax: 2000000, batch: '2021-2025',
    required: ['docker', 'kubernetes', 'aws', 'ci/cd'],
    preferred: ['go', 'system design'],
    sourceType: 'FEED',
  },
  {
    title: 'Full-stack Developer', company: 'BrightPath Fintech',
    description: 'Build customer-facing fintech products with React, Node.js, and PostgreSQL. Care about security, auditability and performance.',
    location: 'Mumbai', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 1000000, salaryMax: 1800000, batch: '2022-2026',
    required: ['javascript', 'react', 'node.js', 'postgresql'],
    preferred: ['typescript', 'docker', 'redis'],
    sourceType: 'ALUMNI',
  },
  {
    title: 'Robotics Software Intern', company: 'Orbit Robotics',
    description: 'Write C++ code for embedded systems and perception pipelines. Work with the SLAM and controls teams.',
    location: 'Pune', workArrangement: 'onsite', employmentType: 'internship',
    minExp: 0, maxExp: 0, salaryMin: 30000, salaryMax: 50000, batch: '2022-2026',
    required: ['c++', 'algorithms', 'data structures'],
    preferred: ['python', 'machine learning'],
    sourceType: 'MANUAL',
  },
  {
    title: 'Data Engineer', company: 'Verdant Health',
    description: 'Build robust data pipelines using Python, PostgreSQL and AWS. Maintain data quality and observability.',
    location: 'Remote (India)', workArrangement: 'remote', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 900000, salaryMax: 1700000, batch: '2021-2025',
    required: ['python', 'postgresql', 'aws'],
    preferred: ['docker', 'ci/cd', 'redis'],
    sourceType: 'MANUAL',
  },
  {
    title: 'Frontend Engineer', company: 'Northwind Tech',
    description: 'Build delightful web UIs with React and TypeScript. Collaborate with designers to ship accessible, performant interfaces. Optimize rendering, write tests, and own features end-to-end.',
    location: 'Bengaluru', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 800000, salaryMax: 1400000, batch: '2022-2026',
    required: ['javascript', 'typescript', 'react', 'html', 'css'],
    preferred: ['tailwind css', 'next.js'],
    sourceType: 'CSV', sourceUrl: 'https://careers.northwind.example/jobs/fe-2024', externalId: 'northwind-fe-001',
  },
  {
    title: 'Backend Engineer', company: 'Helix Cloud',
    description: 'Build Go services powering our cloud platform. Strong emphasis on system design and distributed systems.',
    location: 'Hyderabad', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 2, salaryMin: 1100000, salaryMax: 1900000, batch: '2021-2025',
    required: ['go', 'postgresql', 'system design', 'docker'],
    preferred: ['kubernetes', 'redis', 'aws'],
    sourceType: 'MANUAL',
  },
  {
    title: 'Mobile Engineer', company: 'BrightPath Fintech',
    description: 'Build mobile fintech apps in React Native. Strong focus on UX, performance and security.',
    location: 'Mumbai', workArrangement: 'hybrid', employmentType: 'full-time',
    minExp: 0, maxExp: 1, salaryMin: 900000, salaryMax: 1600000, batch: '2022-2026',
    required: ['javascript', 'react'],
    preferred: ['typescript'],
    sourceType: 'ALUMNI',
  },
]

async function main() {
  console.log('🌱 Seeding Placement Hub database...')

  // Wipe existing data
  await db.notification.deleteMany()
  await db.auditEvent.deleteMany()
  await db.interviewReport.deleteMany()
  await db.offer.deleteMany()
  await db.interview.deleteMany()
  await db.applicationEvent.deleteMany()
  await db.application.deleteMany()
  await db.resumeBullet.deleteMany()
  await db.resume.deleteMany()
  await db.matchResult.deleteMany()
  await db.assessmentResult.deleteMany()
  await db.assessment.deleteMany()
  await db.evidenceReview.deleteMany()
  await db.evidenceSkill.deleteMany()
  await db.evidence.deleteMany()
  await db.project.deleteMany()
  await db.studentSkill.deleteMany()
  await db.education.deleteMany()
  await db.studentProfile.deleteMany()
  await db.officerProfile.deleteMany()
  await db.recruiterProfile.deleteMany()
  await db.alumniProfile.deleteMany()
  await db.duplicateJob.deleteMany()
  await db.jobSkill.deleteMany()
  await db.job.deleteMany()
  await db.company.deleteMany()
  await db.skillAlias.deleteMany()
  await db.skill.deleteMany()
  await db.jobSource.deleteMany()
  await db.user.deleteMany()

  clearNormalizationCache()

  // 1. Skills catalog
  console.log('  → Creating skill catalog...')
  const skillMap = new Map<string, string>()
  for (const s of SKILLS_CATALOG) {
    const skill = await db.skill.create({
      data: {
        canonicalName: s.canonical,
        displayName: s.display,
        category: s.category,
        aliases: {
          create: s.aliases.map(a => ({ alias: a, caseInsensitive: a.toLowerCase().trim() })),
        },
      },
    })
    skillMap.set(s.canonical, skill.id)
  }
  console.log(`  ✓ Created ${SKILLS_CATALOG.length} skills`)

  // 2. Companies
  console.log('  → Creating companies...')
  const companyMap = new Map<string, string>()
  for (const c of COMPANIES) {
    const comp = await db.company.create({ data: c })
    companyMap.set(c.name, comp.id)
  }

  // 3. Officer account
  console.log('  → Creating officer account...')
  const officer = await db.user.create({
    data: {
      email: 'officer@demo.edu',
      name: 'Dr. Priya Placement',
      role: 'OFFICER',
      passwordHash: hashPassword(DEMO_PASSWORD),
      phone: '+91-99999-00001',
      officerProfile: { create: { department: 'Career Development Cell', title: 'Placement Officer' } },
    },
  })

  // 4. Recruiter accounts
  console.log('  → Creating recruiter accounts...')
  const recruiterEmails: Array<{ company: string; name: string; email: string }> = [
    { company: 'Northwind Tech', name: 'Anjali Rao', email: 'recruiter@northwind.example' },
    { company: 'Quantum Labs', name: 'Dev Patel', email: 'recruiter@quantum.example' },
    { company: 'Helix Cloud', name: 'Maya Iyer', email: 'recruiter@helix.example' },
    { company: 'BrightPath Fintech', name: 'Karan Sethi', email: 'recruiter@brightpath.example' },
  ]
  for (const r of recruiterEmails) {
    const companyId = companyMap.get(r.company)!
    await db.user.create({
      data: {
        email: r.email,
        name: r.name,
        role: 'RECRUITER',
        passwordHash: hashPassword(DEMO_PASSWORD),
        phone: '+91-99999-00002',
        recruiterProfile: {
          create: { companyId, position: 'Senior Technical Recruiter' },
        },
      },
    })
  }

  // 5. Admin
  console.log('  → Creating admin account...')
  await db.user.create({
    data: {
      email: 'admin@demo.edu',
      name: 'System Administrator',
      role: 'ADMIN',
      passwordHash: hashPassword(DEMO_PASSWORD),
    },
  })

  // 6. Students with profiles, skills, evidence
  console.log('  → Creating students with profiles, skills, evidence...')
  for (let i = 0; i < STUDENT_DATA.length; i++) {
    const s = STUDENT_DATA[i]
    const user = await db.user.create({
      data: {
        email: s.email,
        name: s.name,
        role: 'STUDENT',
        passwordHash: hashPassword(DEMO_PASSWORD),
      },
    })
    const profile = await db.studentProfile.create({
      data: {
        userId: user.id,
        university: 'National Institute of Technology',
        batch: s.batch,
        branch: s.branch,
        cgpa: s.cgpa,
        bio: s.bio,
        location: s.location,
        githubUser: s.githubUser,
        linkedinUrl: `https://linkedin.com/in/${s.githubUser}`,
        portfolioUrl: `https://${s.githubUser}.github.io`,
        graduationYear: parseInt(s.batch.split('-')[1], 10),
        profileCompletion: 75,
      },
    })

    const [startYear, endYear] = s.batch.split('-').map(x => parseInt(x, 10))
    await db.education.create({
      data: {
        studentId: profile.id,
        degree: 'B.Tech',
        institution: 'National Institute of Technology',
        startYear,
        endYear,
        score: s.cgpa,
        scoreType: 'cgpa',
        field: s.branch,
      },
    })

    let verified = true
    for (const sk of s.skills) {
      const skillId = skillMap.get(sk.name)
      if (!skillId) continue
      const isVerified = verified && sk.level !== 'beginner'
      await db.studentSkill.create({
        data: {
          studentId: profile.id,
          skillId,
          selfRated: sk.level,
          isClaimed: true,
          isVerified,
          source: 'self',
        },
      })

      const status = isVerified ? 'VERIFIED' : (verified ? 'PENDING_REVIEW' : 'UNVERIFIED')
      const evidenceTypes = ['assessment', 'project', 'github', 'certification'] as const
      const evType = evidenceTypes[Math.floor(Math.random() * evidenceTypes.length)]
      const evidence = await db.evidence.create({
        data: {
          studentId: profile.id,
          type: evType,
          title: `${s.name.split(' ')[0]}'s ${sk.name.toUpperCase()} ${evType}`,
          description: `Evidence supporting ${sk.name} skill. Submitted by student for review.`,
          sourceUrl: evType === 'github' ? `https://github.com/${s.githubUser}/project-${i}-${sk.name.replace(/\W/g, '')}` : undefined,
          organization: evType === 'certification' ? 'Coursera' : evType === 'assessment' ? 'HackerRank' : undefined,
          assessor: evType === 'assessment' ? 'Prof. Reviewer' : undefined,
          score: evType === 'assessment' ? Math.floor(60 + Math.random() * 40) : null,
          maxScore: evType === 'assessment' ? 100 : null,
          status,
          reviewerId: status === 'VERIFIED' ? officer.id : null,
          reviewerNotes: status === 'VERIFIED' ? 'Verified during placement review cycle.' : undefined,
          reviewedAt: status === 'VERIFIED' ? new Date() : null,
          provenance: JSON.stringify({ submittedBy: user.id, source: 'self' }),
        },
      })
      await db.evidenceSkill.create({
        data: { evidenceId: evidence.id, skillId, relevance: 1.0 },
      })
      verified = !verified
    }

    await db.project.create({
      data: {
        studentId: profile.id,
        title: `${s.name.split(' ')[0]}'s Capstone Project`,
        description: `A capstone project showcasing ${s.skills.slice(0, 3).map(x => x.name).join(', ')} capabilities.`,
        repoUrl: `https://github.com/${s.githubUser}/capstone`,
        demoUrl: `https://${s.githubUser}.github.io/capstone`,
        status: 'COMPLETED',
        teamSize: 3,
        role: 'Lead Developer',
      },
    })
  }
  console.log(`  ✓ Created ${STUDENT_DATA.length} students with skills and evidence`)

  // 7. Assessments + results
  console.log('  → Creating assessments...')
  const dsaSkill = skillMap.get('data structures')!
  const dsaAssessment = await db.assessment.create({
    data: {
      name: 'DSA Proficiency Test',
      organization: 'HackerRank',
      skillId: dsaSkill,
      maxScore: 100,
      description: 'Standard DSA proficiency assessment covering arrays, trees, graphs and DP.',
    },
  })
  const studentsForResults = await db.studentProfile.findMany({ take: 8 })
  for (const sp of studentsForResults) {
    const score = 60 + Math.floor(Math.random() * 35)
    await db.assessmentResult.create({
      data: {
        assessmentId: dsaAssessment.id,
        studentId: sp.id,
        score,
        percentile: 50 + Math.floor(Math.random() * 45),
      },
    })
  }

  // 8. Jobs
  console.log('  → Creating jobs...')
  const jobIds: string[] = []
  for (const j of JOBS) {
    const companyId = companyMap.get(j.company)
    if (!companyId) continue
    const job = await db.job.create({
      data: {
        title: j.title,
        companyId,
        description: j.description,
        location: j.location,
        workArrangement: j.workArrangement,
        employmentType: j.employmentType,
        minExperience: j.minExp,
        maxExperience: j.maxExp,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        applicationUrl: `https://example.com/apply/${j.title.toLowerCase().replace(/\W+/g, '-')}`,
        closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'OPEN',
        sourceType: j.sourceType,
        sourceUrl: j.sourceUrl,
        externalId: j.externalId,
        batchEligible: j.batch,
        eligibilityCriteria: `Eligible batch: ${j.batch}. CGPA >= 7.0. No active backlogs.`,
      },
    })
    jobIds.push(job.id)
    for (const skName of j.required) {
      const sid = skillMap.get(skName)
      if (!sid) continue
      await db.jobSkill.create({
        data: { jobId: job.id, skillId: sid, weight: 4, isRequired: true, minLevel: 'intermediate' },
      })
    }
    for (const skName of j.preferred) {
      const sid = skillMap.get(skName)
      if (!sid) continue
      await db.jobSkill.create({
        data: { jobId: job.id, skillId: sid, weight: 1, isRequired: false, minLevel: 'beginner' },
      })
    }
  }
  console.log(`  ✓ Created ${JOBS.length} jobs`)

  // 9. Pre-compute match results
  console.log('  → Pre-computing match results...')
  const students = await db.studentProfile.findMany({
    include: {
      skills: { include: { skill: true } },
      evidence: { include: { skills: true } },
    },
  })
  const jobs = await db.job.findMany({ include: { requirements: { include: { skill: true } } } })
  let matchCount = 0
  for (const job of jobs) {
    for (const student of students) {
      const reqs = job.requirements.map(r => ({
        skillId: r.skillId,
        displayName: r.skill.displayName,
        isRequired: r.isRequired,
        weight: r.weight,
      }))
      const studentEvidence = job.requirements.map(r => {
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
      const EVIDENCE_VALUE_RULES: Record<string, number> = {
        VERIFIED: 1.0, PENDING_REVIEW: 0.25, UNVERIFIED: 0.25, REJECTED: 0, NEEDS_MORE_EVIDENCE: 0,
      }
      let totalWeightedMatch = 0, totalWeight = 0, reqCovered = 0, reqTotal = 0, prefCovered = 0, prefTotal = 0
      const matchingSkills: any[] = []
      const missingSkills: any[] = []
      const breakdown: any[] = []
      for (const req of reqs) {
        const ev = studentEvidence.find(se => se.skillId === req.skillId)?.evidence ?? []
        let max = 0, best: any = undefined
        for (const e of ev) {
          const base = EVIDENCE_VALUE_RULES[e.status] ?? 0
          const value = base * Math.max(0, Math.min(1, e.relevance))
          if (value > max) { max = value; best = e }
        }
        totalWeightedMatch += req.weight * max
        totalWeight += req.weight
        if (req.isRequired) {
          reqTotal += 1
          if (max >= 0.25) reqCovered += 1
          if (max === 0) missingSkills.push({ skillId: req.skillId, name: req.displayName, weight: req.weight, isRequired: true, status: ev.length === 0 ? 'NO_EVIDENCE' : 'INSUFFICIENT_EVIDENCE' })
        } else {
          prefTotal += 1
          if (max >= 0.25) prefCovered += 1
          if (max === 0) missingSkills.push({ skillId: req.skillId, name: req.displayName, weight: req.weight, isRequired: false, status: ev.length === 0 ? 'NO_EVIDENCE' : 'INSUFFICIENT_EVIDENCE' })
        }
        if (max >= 0.25 && best) {
          matchingSkills.push({ skillId: req.skillId, name: req.displayName, evidenceIds: ev.filter(e => EVIDENCE_VALUE_RULES[e.status] > 0).map(e => e.evidenceId) })
        }
        breakdown.push({ skillId: req.skillId, displayName: req.displayName, isRequired: req.isRequired, weight: req.weight, matchValue: max, bestEvidence: best, evidenceCount: ev.length })
      }
      const fitScore = totalWeight === 0 ? 0 : Math.round((totalWeightedMatch / totalWeight) * 1000) / 10
      const requiredCoverage = reqTotal === 0 ? 1 : reqCovered / reqTotal
      const preferredCoverage = prefTotal === 0 ? 1 : prefCovered / prefTotal

      await db.matchResult.create({
        data: {
          jobId: job.id,
          studentId: student.id,
          fitScore,
          requiredCoverage,
          preferredCoverage,
          matchingSkills: JSON.stringify(matchingSkills),
          missingSkills: JSON.stringify(missingSkills),
          explanation: JSON.stringify({ breakdown, factorsSummary: '', recommendation: '' }),
          algorithmVersion: 'v1.0',
          inputs: JSON.stringify({}),
        },
      })
      matchCount++
    }
  }
  console.log(`  ✓ Created ${matchCount} match results`)

  // 10. Sample applications
  console.log('  → Creating sample applications...')
  const statuses = ['APPLIED', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']
  let appCount = 0
  for (let i = 0; i < Math.min(students.length, 10); i++) {
    const student = students[i]
    const numApps = 2 + Math.floor(Math.random() * 3)
    for (let j = 0; j < numApps && j < jobs.length; j++) {
      const job = jobs[(i + j) % jobs.length]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      try {
        await db.application.create({
          data: {
            studentId: student.id,
            jobId: job.id,
            status,
            coverLetter: `I am excited to apply for the ${job.title} role.`,
            events: {
              create: [{
                newStatus: 'APPLIED',
                actorId: officer.id,
                reason: 'Initial application submitted',
              }],
            },
          },
        })
        appCount++
      } catch (e) {
        // skip duplicates
      }
    }
  }
  console.log(`  ✓ Created ${appCount} applications`)

  // 11. Interviews and offers
  console.log('  → Creating interviews and offers...')
  const someApps = await db.application.findMany({ take: 5 })
  for (const app of someApps) {
    await db.interview.create({
      data: {
        applicationId: app.id,
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        duration: 60,
        location: 'Virtual',
        meetingUrl: `https://meet.example.com/interview-${app.id.slice(0, 6)}`,
        type: 'TECHNICAL',
        round: 1,
        notes: 'Technical interview. Be ready to discuss system design and DSA.',
      },
    })
    if (Math.random() > 0.5) {
      await db.offer.create({
        data: {
          applicationId: app.id,
          amount: 900000 + Math.floor(Math.random() * 800000),
          currency: 'INR',
          decision: Math.random() > 0.5 ? 'ACCEPTED' : 'PENDING',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      })
    }
  }

  // 12. Job sources
  await db.jobSource.create({ data: { name: 'Manual', type: 'MANUAL', status: 'ACTIVE', count: 5 } })
  await db.jobSource.create({ data: { name: 'Partner Feed - Northwind', type: 'FEED', status: 'ACTIVE', count: 2, endpoint: 'https://example.com/feed' } })
  await db.jobSource.create({ data: { name: 'Alumni Referrals', type: 'ALUMNI', status: 'ACTIVE', count: 2 } })
  await db.jobSource.create({ data: { name: 'CSV Import', type: 'CSV', status: 'ACTIVE', count: 1 } })

  // 13. Audit event
  await db.auditEvent.create({
    data: {
      actorId: officer.id,
      action: 'EVIDENCE_REVIEW',
      targetType: 'Evidence',
      reason: 'Bulk evidence review during placement cycle',
      metadata: JSON.stringify({ status: 'VERIFIED' }),
    },
  })

  console.log('✅ Seeding complete!\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(' DEMO CREDENTIALS (clearly fake/synthetic)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(` Student:    <student-email>@demo.edu  / ${DEMO_PASSWORD}`)
  console.log('   (e.g. aarav.sharma@demo.edu)')
  console.log(` Officer:    officer@demo.edu       / ${DEMO_PASSWORD}`)
  console.log(` Recruiter:  recruiter@northwind.example / ${DEMO_PASSWORD}`)
  console.log(` Admin:      admin@demo.edu         / ${DEMO_PASSWORD}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main()
  .catch(e => {
    console.error('Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
