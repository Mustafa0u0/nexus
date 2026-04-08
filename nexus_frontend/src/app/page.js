'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  AudioLines,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Search,
  Sparkles,
  Target,
  Upload,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import { registerUser } from '@/lib/api';
import { saveStoredUser } from '@/lib/auth';
import {
  BrandLockup,
  Panel,
  ProgressBar,
  ScoreDonut,
  SectionHeader,
  StatusBadge,
  dimensionMeta,
  fadeUp,
  stagger,
} from '@/components/nexus-ui';

const navLinks = [
  ['Product', 'product'],
  ['How It Works', 'how-it-works'],
  ['Features', 'features'],
  ['Reports', 'reports'],
  ['Pricing', 'pricing'],
  ['Contact', 'contact'],
];

const logos = ['Northstar', 'Helio Labs', 'Monarch Tech', 'Pioneer Cloud', 'Aster Works'];

const problems = [
  'Screening takes too long in the early funnel.',
  'Interview quality changes between reviewers.',
  'Candidate comparison is hard to defend.',
  'Recruiters lose time before the shortlist is even clear.',
];

const solutions = [
  'Structured AI interviews standardize candidate evaluation.',
  'Ten-dimension scoring makes candidates easier to compare.',
  'Reports package transcript evidence and recommendation in one place.',
  'Recruiters move faster with clearer signal and less admin work.',
];

const workflow = [
  {
    icon: BriefcaseBusiness,
    title: 'Create the role',
    copy: 'Recruiters create a job and generate an interview code.',
  },
  {
    icon: Upload,
    title: 'Candidate starts',
    copy: 'Candidates enter the code, upload a CV, and begin the AI interview.',
  },
  {
    icon: Target,
    title: 'AI evaluates',
    copy: 'Responses are scored across six structured competency dimensions.',
  },
  {
    icon: FileText,
    title: 'Reports arrive',
    copy: 'Recruiters receive recommendation, insights, transcript, and scoring.',
  },
];

const features = [
  { icon: AudioLines, title: 'AI Voice Interview', copy: 'A guided voice-first experience for consistent screening.' },
  { icon: Target, title: 'Competency Scoring', copy: 'Structured scoring across the six Mihna evaluation dimensions.' },
  { icon: Zap, title: 'Real-Time Assessment', copy: 'Immediate evaluation during the interview loop.' },
  { icon: BarChart3, title: 'Radar Chart Reports', copy: 'Premium reporting visuals for faster review.' },
  { icon: Search, title: 'Skill Gap Analysis', copy: 'See how candidate profile and role expectations align.' },
  { icon: MessageSquare, title: 'Transcript Highlights', copy: 'Review scoring with concrete transcript evidence.' },
  { icon: CheckCircle2, title: 'Hiring Recommendation', copy: 'Turn interviews into actionable decisions quickly.' },
  { icon: LayoutDashboard, title: 'Recruiter Dashboard', copy: 'Manage jobs, applicants, interviews, and reports in one place.' },
];

const recruiterBenefits = [
  'Reduce manual screening time.',
  'Standardize early candidate evaluation.',
  'Shortlist faster with clearer evidence.',
];

const candidateBenefits = [
  'A more structured and fair experience.',
  'A clearer interview flow from start to finish.',
  'Less guesswork and more consistency.',
];

const impactMetrics = [
  { value: '68%', label: 'less screening time' },
  { value: '3x', label: 'faster shortlist creation' },
  { value: '100%', label: 'structured evaluation coverage' },
  { value: '<10 min', label: 'report turnaround' },
];

function RadarChartPreview() {
  const values = [86, 83, 88, 81, 84, 78, 85, 80, 77, 89];
  const center = 120;
  const radius = 78;
  const axisIndexes = Array.from({ length: values.length }, (_, index) => index);

  const points = values
    .map((value, index) => {
      const angle = ((Math.PI * 2) / values.length) * index - Math.PI / 2;
      const pointRadius = (value / 100) * radius;
      const x = center + Math.cos(angle) * pointRadius;
      const y = center + Math.sin(angle) * pointRadius;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="radar-shell">
      <svg viewBox="0 0 240 240" className="radar-svg" aria-hidden="true">
        {[24, 40, 56, 72, 88].map(size => (
          <polygon
            key={size}
            points={axisIndexes
              .map(index => {
                const angle = ((Math.PI * 2) / values.length) * index - Math.PI / 2;
                const x = 120 + Math.cos(angle) * size;
                const y = 120 + Math.sin(angle) * size;
                return `${x},${y}`;
              })
              .join(' ')}
            className="radar-grid"
          />
        ))}
        {axisIndexes.map(index => {
          const angle = ((Math.PI * 2) / values.length) * index - Math.PI / 2;
          const x = 120 + Math.cos(angle) * 88;
          const y = 120 + Math.sin(angle) * 88;
          return <line key={index} x1="120" y1="120" x2={x} y2={y} className="radar-axis" />;
        })}
        <polygon points={points} className="radar-area" />
        <polyline points={points} className="radar-line" />
        {values.map((value, index) => {
          const angle = ((Math.PI * 2) / values.length) * index - Math.PI / 2;
          const pointRadius = (value / 100) * radius;
          const x = center + Math.cos(angle) * pointRadius;
          const y = center + Math.sin(angle) * pointRadius;
          return <circle key={dimensionMeta[index].key} cx={x} cy={y} r="4.5" className="radar-point" />;
        })}
      </svg>
      <div className="radar-label-grid">
        {dimensionMeta.map(item => (
          <div key={item.key} className="radar-label-item">
            <span className="radar-label-name">{item.label}</span>
            <span className="radar-label-value">{item.weight}% weight</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrowserMockup({ title, kicker, children, badge, className }) {
  return (
    <div className={`browser-mockup ${className || ''}`}>
      <div className="browser-topbar">
        <div className="browser-dots">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-address">{kicker}</div>
        {badge ? <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> : <span />}
      </div>
      <div className="browser-body">
        <div className="browser-title-row">
          <div>
            <div className="preview-kicker">{kicker}</div>
            <div className="preview-title">{title}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState('hr');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (!name.trim() || !email.trim() || !selectedRole) return;

    setLoading(true);
    setError('');

    try {
      const user = await registerUser(name.trim(), email.trim(), selectedRole);
      saveStoredUser(user);
      router.push(user.role === 'hr' ? '/hr' : '/employee');
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setLoading(false);
    }
  }

  function openStartModal(role = 'hr') {
    setSelectedRole(role);
    setError('');
    setShowStartModal(true);
  }

  return (
    <div className="page-container marketing-page">
      <header className="navbar marketing-header">
        <div className="navbar-inner marketing-nav-shell">
          <BrandLockup />

          <nav className="marketing-nav-links" aria-label="Primary">
            {navLinks.map(([label, id]) => (
              <a key={id} href={`#${id}`} className="marketing-nav-link">
                {label}
              </a>
            ))}
          </nav>

          <div className="marketing-nav-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDemoModal(true)} type="button">
              Book Demo
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => openStartModal('hr')} type="button">
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="page-shell stack-xl marketing-shell">
        <motion.section id="product" initial="hidden" animate="visible" variants={stagger} className="marketing-hero-grid">
          <motion.div variants={fadeUp} className="marketing-hero-copy">
            <span className="eyebrow">
              <Sparkles size={14} />
              Structured AI screening for modern hiring teams
            </span>
            <h1 className="marketing-hero-title">AI interviews that screen smarter and hire faster.</h1>
            <p className="marketing-hero-subtitle">
              Mihna automates candidate screening with structured AI interviews, real-time assessment, competency scoring, and hiring reports that are easy to act on.
            </p>

            <div className="marketing-hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => openStartModal('hr')} type="button">
                Get Started
                <ArrowRight size={16} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => setShowDemoModal(true)} type="button">
                Book Demo
              </button>
            </div>

            <div className="marketing-trust-line">
              <span>AI voice interview</span>
              <span>6 scoring dimensions</span>
              <span>Executive-ready reports</span>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} className="hero-product-stage">
            <div className="hero-orb hero-orb-a" />
            <div className="hero-orb hero-orb-b" />
            <BrowserMockup
              badge={{ label: 'Live', tone: 'success' }}
              className="hero-browser-primary"
              kicker="Recruiter dashboard"
              title="Structured screening command center"
            >
              <div className="browser-grid-two">
                <Panel className="panel-muted browser-mini-card">
                  <div className="preview-kicker">Pipeline</div>
                  <div className="preview-title">24 active applicants</div>
                  <div className="stack-md">
                    {[
                      ['Screening', 18],
                      ['Interviewing', 10],
                      ['Reports ready', 6],
                    ].map(([label, value]) => (
                      <div key={label} className="stack-md">
                        <div className="bar-row">
                          <span className="bar-label">{label}</span>
                          <span className="bar-value">{value}</span>
                        </div>
                        <ProgressBar max={24} value={Number(value)} />
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel className="panel-brand browser-mini-card">
                  <div className="preview-kicker">Hiring report</div>
                  <div className="preview-title">Senior Backend Engineer</div>
                  <ScoreDonut label="Overall score" sublabel="84% confidence" value={4.2} />
                </Panel>
              </div>
            </BrowserMockup>

            <BrowserMockup
              badge={{ label: 'Voice AI', tone: 'brand' }}
              className="hero-browser-float hero-browser-secondary"
              kicker="Candidate interview"
              title="Guided interview session"
            >
              <div className="voice-orb-shell">
                <div className="voice-orb">
                  <Mic size={24} />
                </div>
              </div>
              <Panel className="panel-muted browser-mini-card">
                <div className="preview-kicker">Current question</div>
                <div className="preview-title">How did you improve a system under delivery pressure?</div>
              </Panel>
            </BrowserMockup>
          </motion.div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} variants={stagger} className="marketing-logo-strip">
          <motion.div variants={fadeUp} className="marketing-logo-label">
            Trusted by modern hiring teams and growing companies
          </motion.div>
          <motion.div variants={fadeUp} className="marketing-logo-row">
            {logos.map(logo => (
              <div key={logo} className="marketing-logo-pill">
                {logo}
              </div>
            ))}
          </motion.div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <SectionHeader
              eyebrow="Problem and solution"
              title="Replace messy early screening with consistent hiring signal"
              subtitle="Mihna keeps the first interview stage structured, faster, and easier to defend."
            />
          </motion.div>

          <div className="marketing-problem-grid">
            <motion.div variants={fadeUp}>
              <Panel className="marketing-problem-card">
                <div className="marketing-compare-kicker">Traditional screening</div>
                <h3 className="marketing-compare-title">Too much time, not enough clarity.</h3>
                <ul className="marketing-check-list">
                  {problems.map(problem => (
                    <li key={problem}>
                      <span className="marketing-check-bullet danger" />
                      <span>{problem}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Panel className="marketing-solution-card">
                <div className="marketing-compare-kicker">Mihna</div>
                <h3 className="marketing-compare-title">One system from interview to report.</h3>
                <ul className="marketing-check-list">
                  {solutions.map(solution => (
                    <li key={solution}>
                      <span className="marketing-check-bullet success" />
                      <span>{solution}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.div>
          </div>
        </motion.section>

        <motion.section id="how-it-works" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <SectionHeader
              eyebrow="How it works"
              title="A simple four-step hiring flow"
              subtitle="Short, structured, and recruiter-ready from start to finish."
            />
          </motion.div>

          <div className="marketing-steps-grid">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.title} variants={fadeUp}>
                  <Panel className="marketing-step-card">
                    <div className="marketing-step-top">
                      <div className="marketing-step-number">0{index + 1}</div>
                      <div className="landing-role-icon">
                        <Icon size={20} />
                      </div>
                    </div>
                    <h3 className="card-title">{step.title}</h3>
                    <p className="card-copy">{step.copy}</p>
                  </Panel>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <motion.section id="features" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <SectionHeader
              eyebrow="Features"
              title="The core platform, without the noise"
              subtitle="Everything important is still here. It is just presented more clearly."
            />
          </motion.div>

          <div className="marketing-feature-grid">
            {features.map(feature => {
              const Icon = feature.icon;
              return (
                <motion.div key={feature.title} variants={fadeUp}>
                  <Panel className="marketing-feature-card">
                    <div className="landing-role-icon">
                      <Icon size={20} />
                    </div>
                    <h3 className="card-title">{feature.title}</h3>
                    <p className="card-copy">{feature.copy}</p>
                  </Panel>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <motion.section id="reports" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <SectionHeader
              eyebrow="Scoring and reports"
              title="Make the product feel intelligent and evidence-based"
              subtitle="The ten scoring dimensions and the report surface do most of the selling once people see them."
            />
          </motion.div>

          <div className="marketing-report-grid">
            <motion.div variants={fadeUp}>
              <Panel className="marketing-radar-card">
                <div className="preview-kicker">Scoring module</div>
                <div className="preview-title">Ten-dimension evaluation map</div>
                <RadarChartPreview />
              </Panel>
            </motion.div>

            <motion.div variants={fadeUp}>
              <div className="stack-lg">
                <BrowserMockup badge={{ label: 'Recommend', tone: 'success' }} kicker="Hiring report" title="Executive-ready report">
                  <div className="stack-md">
                    {[
                      ['Technical', 86],
                      ['Communication', 88],
                      ['Role Alignment', 84],
                    ].map(([label, value]) => (
                      <div key={label} className="stack-md">
                        <div className="bar-row">
                          <span className="bar-label">{label}</span>
                          <span className="bar-value">{value}/100</span>
                        </div>
                        <ProgressBar value={Number(value)} />
                      </div>
                    ))}
                    <div className="tag-row">
                      <StatusBadge tone="success">Strengths</StatusBadge>
                      <StatusBadge tone="warning">Skill gaps</StatusBadge>
                      <StatusBadge tone="brand">Transcript</StatusBadge>
                    </div>
                  </div>
                </BrowserMockup>

                <Panel className="marketing-impact-panel">
                  <div className="landing-role-icon">
                    <ClipboardList size={20} />
                  </div>
                  <h3 className="card-title">Recommendation, transcript, and evidence in one view</h3>
                  <p className="card-copy">
                    This is the moment where recruiters stop guessing and start deciding.
                  </p>
                </Panel>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <motion.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <SectionHeader
              eyebrow="Benefits and impact"
              title="Clear value for recruiters and candidates"
              subtitle="Shorter, sharper, and easier to scan."
            />
          </motion.div>

          <div className="marketing-benefits-grid">
            <motion.div variants={fadeUp}>
              <Panel className="marketing-benefit-card">
                <div className="marketing-benefit-top">
                  <div className="landing-role-icon">
                    <Users size={20} />
                  </div>
                  <div>
                    <div className="preview-kicker">For recruiters</div>
                    <div className="preview-title">Faster and clearer early hiring decisions</div>
                  </div>
                </div>
                <ul className="marketing-check-list compact">
                  {recruiterBenefits.map(item => (
                    <li key={item}>
                      <span className="marketing-check-bullet success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.div>

            <motion.div variants={fadeUp}>
              <Panel className="marketing-benefit-card">
                <div className="marketing-benefit-top">
                  <div className="landing-role-icon">
                    <UserRound size={20} />
                  </div>
                  <div>
                    <div className="preview-kicker">For candidates</div>
                    <div className="preview-title">A more consistent interview experience</div>
                  </div>
                </div>
                <ul className="marketing-check-list compact">
                  {candidateBenefits.map(item => (
                    <li key={item}>
                      <span className="marketing-check-bullet success" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </motion.div>
          </div>

          <div className="marketing-impact-grid">
            {impactMetrics.map(metric => (
              <motion.div key={metric.label} variants={fadeUp}>
                <Panel className="marketing-impact-card">
                  <div className="marketing-impact-value">{metric.value}</div>
                  <div className="marketing-impact-label">{metric.label}</div>
                </Panel>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section id="pricing" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <Panel className="marketing-pricing-placeholder">
              <SectionHeader
                eyebrow="Pricing"
                title="Pricing is not fixed yet"
                subtitle="We are still shaping packages based on hiring volume, rollout needs, and reporting depth."
                actions={
                  <div className="page-actions">
                    <button className="btn btn-secondary" onClick={() => setShowDemoModal(true)} type="button">
                      Ask about pricing
                    </button>
                    <button className="btn btn-primary" onClick={() => openStartModal('hr')} type="button">
                      Get Started
                    </button>
                  </div>
                }
              />

              <div className="marketing-pricing-note">
                <div className="tag-row">
                  <StatusBadge tone="warning">Not finalized</StatusBadge>
                  <StatusBadge tone="brand">Demo-based pricing conversations</StatusBadge>
                </div>
                <p className="card-copy">
                  For now, the best path is a demo conversation. We will walk through your hiring process, expected volume, and the right rollout shape for your team.
                </p>
              </div>
            </Panel>
          </motion.div>
        </motion.section>

        <motion.section id="contact" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.25 }} variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <Panel className="marketing-final-cta">
              <div className="marketing-final-copy">
                <span className="eyebrow">
                  <Sparkles size={14} />
                  Ready to see Mihna in action?
                </span>
                <h2 className="marketing-final-title">Bring structured AI interviews into your hiring workflow.</h2>
                <p className="marketing-final-subtitle">
                  Book a demo with the team or jump into the platform now and explore the recruiter workspace.
                </p>
              </div>

              <div className="marketing-final-actions">
                <button className="btn btn-secondary btn-lg" onClick={() => setShowDemoModal(true)} type="button">
                  Book Demo
                </button>
                <button className="btn btn-primary btn-lg" onClick={() => openStartModal('hr')} type="button">
                  Get Started
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="marketing-final-trust">
                Built for hiring teams that want more consistency, less guesswork, and faster decisions.
              </div>
            </Panel>
          </motion.div>
        </motion.section>
      </main>

      <footer className="marketing-footer">
        <div className="page-shell marketing-footer-shell">
          <div className="marketing-footer-brand">
            <BrandLockup />
            <p className="card-copy">Premium AI interview infrastructure for modern recruiting teams.</p>
          </div>

          <div className="marketing-footer-grid">
            <div>
              <div className="marketing-footer-title">Product</div>
              <a href="#product">Overview</a>
              <a href="#features">Features</a>
              <a href="#reports">Reports</a>
            </div>
            <div>
              <div className="marketing-footer-title">Company</div>
              <a href="#how-it-works">How it works</a>
              <button className="marketing-footer-link-button" onClick={() => setShowDemoModal(true)} type="button">
                Book Demo
              </button>
              <button className="marketing-footer-link-button" onClick={() => openStartModal('hr')} type="button">
                Get Started
              </button>
            </div>
            <div>
              <div className="marketing-footer-title">Contact</div>
              <a href="mailto:Mustafa.r2018@gmail.com">Mustafa.r2018@gmail.com</a>
              <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              <a href="https://www.x.com" target="_blank" rel="noreferrer">
                X
              </a>
            </div>
            <div>
              <div className="marketing-footer-title">Legal</div>
              <a href="#contact">Privacy</a>
              <a href="#contact">Terms</a>
              <a href="#contact">Security</a>
            </div>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showStartModal ? (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={event => {
              if (event.target === event.currentTarget) {
                setShowStartModal(false);
                setError('');
              }
            }}
          >
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="modal-head">
                <div>
                  <h2 className="modal-title">{selectedRole === 'hr' ? 'Get started as a recruiter' : 'Enter the candidate portal'}</h2>
                  <p className="modal-copy">
                    {selectedRole === 'hr'
                      ? 'Create a recruiter profile to manage jobs, candidates, and AI interview reports.'
                      : 'Create a candidate profile to browse jobs, upload your CV, and complete AI interviews.'}
                  </p>
                </div>
                <StatusBadge tone={selectedRole === 'hr' ? 'brand' : 'accent'}>
                  {selectedRole === 'hr' ? 'Recruiter' : 'Candidate'}
                </StatusBadge>
              </div>

              <div className="pill-tabs" style={{ marginBottom: '1rem' }}>
                <button className={`pill-tab${selectedRole === 'hr' ? ' active' : ''}`} onClick={() => setSelectedRole('hr')} type="button">
                  Recruiter
                </button>
                <button
                  className={`pill-tab${selectedRole === 'employee' ? ' active' : ''}`}
                  onClick={() => setSelectedRole('employee')}
                  type="button"
                >
                  Candidate
                </button>
              </div>

              <form className="form-grid" onSubmit={handleSubmit}>
                <label className="form-group">
                  <span className="form-label">Full name</span>
                  <input
                    autoFocus
                    className="form-input"
                    onChange={event => setName(event.target.value)}
                    placeholder="Aisha Noor"
                    required
                    type="text"
                    value={name}
                  />
                </label>

                <label className="form-group">
                  <span className="form-label">Email address</span>
                  <input
                    className="form-input"
                    onChange={event => setEmail(event.target.value)}
                    placeholder="aisha@company.com"
                    required
                    type="email"
                    value={email}
                  />
                </label>

                {error ? <div className="alert alert-error">{error}</div> : null}

                <div className="hero-actions">
                  <button className="btn btn-secondary" onClick={() => setShowStartModal(false)} type="button">
                    Cancel
                  </button>
                  <button className="btn btn-primary" disabled={loading} type="submit">
                    {loading ? 'Signing in…' : 'Continue to Mihna'}
                    {!loading ? <ArrowRight size={16} /> : null}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}

        {showDemoModal ? (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={event => {
              if (event.target === event.currentTarget) {
                setShowDemoModal(false);
              }
            }}
          >
            <motion.div
              className="modal-card"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="modal-head">
                <div>
                  <h2 className="modal-title">Book a Mihna demo</h2>
                  <p className="modal-copy">
                    Pricing is not fixed yet. The next step is a short demo conversation so we can understand your hiring workflow.
                  </p>
                </div>
                <StatusBadge tone="warning">Demo first</StatusBadge>
              </div>

              <Panel className="panel-muted">
                <div className="list-points">
                  <div className="list-point">
                    <span className="list-point-dot" />
                    <div>
                      <strong>What we will cover</strong>
                      <p className="card-copy">Your hiring volume, the roles you are screening, and the report detail you need.</p>
                    </div>
                  </div>
                  <div className="list-point">
                    <span className="list-point-dot" />
                    <div>
                      <strong>Current pricing status</strong>
                      <p className="card-copy">Packages are still being finalized, so pricing is handled through direct conversations right now.</p>
                    </div>
                  </div>
                </div>
              </Panel>

              <div className="hero-actions" style={{ marginTop: '1rem' }}>
                <a className="btn btn-secondary" href="mailto:Mustafa.r2018@gmail.com?subject=Mihna%20Demo%20Request">
                  Email the team
                </a>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDemoModal(false);
                    openStartModal('hr');
                  }}
                  type="button"
                >
                  Explore the platform
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
