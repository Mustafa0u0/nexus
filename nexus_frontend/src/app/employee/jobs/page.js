'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Search,
  Upload,
} from 'lucide-react';
import { applyForJob, listJobs } from '@/lib/api';
import { signOutUser, useStoredUser } from '@/lib/auth';
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  PillTabs,
  SectionHeader,
  StatusBadge,
  TopNav,
  fadeUp,
  formatCompactDate,
  stagger,
} from '@/components/nexus-ui';

const navItems = [
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/jobs', label: 'Jobs', icon: Search },
];

const filterOptions = [
  { value: 'all', label: 'All open roles' },
  { value: 'quiet', label: 'Lower competition' },
  { value: 'popular', label: 'Popular roles' },
];

export default function BrowseJobsPage() {
  const router = useRouter();
  const user = useStoredUser('employee');
  const fileRef = useRef(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(null);
  const [cvText, setCvText] = useState('');
  const [cvFile, setCvFile] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    listJobs('open')
      .then(data => {
        if (mounted) setJobs(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return null;

  async function handleApply(event) {
    event.preventDefault();
    if (!cvText.trim() && !cvFile) {
      setError('Please upload your CV or paste the text before submitting.');
      return;
    }

    setError('');

    try {
      await applyForJob(applying.id, user.id, cvText, cvFile);
      setSuccess(`Application submitted for ${applying.title}.`);
      setApplying(null);
      setCvText('');
      setCvFile(null);
      const refreshedJobs = await listJobs('open');
      setJobs(refreshedJobs);
      setTimeout(() => setSuccess(''), 4000);
    } catch (submissionError) {
      setError(submissionError.message);
    }
  }

  const filteredJobs = jobs
    .filter(job => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!normalizedQuery) return true;
      return (
        job.title.toLowerCase().includes(normalizedQuery) ||
        job.description_text.toLowerCase().includes(normalizedQuery)
      );
    })
    .filter(job => {
      if (filter === 'quiet') return (job.applicant_count || 0) < 5;
      if (filter === 'popular') return (job.applicant_count || 0) >= 5;
      return true;
    });

  return (
    <div className="page-container">
      <TopNav
        activeHref="/employee/jobs"
        helperText="Candidate workspace"
        items={navItems}
        onSignOut={() => signOutUser(router)}
        user={user}
      />

      <main className="page-shell stack-xl">
        <motion.section initial="hidden" animate="visible" variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <PageHeader
              eyebrow="Open roles"
              title="Find the right role with less friction"
              subtitle="Browse current positions, understand demand instantly, and apply in a cleaner, higher-trust experience."
              actions={
                <div className="page-actions">
                  <Link className="btn btn-secondary" href="/employee">
                    Back to dashboard
                  </Link>
                </div>
              }
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <Panel className="panel-brand stack-lg">
              <SectionHeader
                eyebrow="Search and filter"
                title={`${filteredJobs.length} open role${filteredJobs.length === 1 ? '' : 's'} available`}
                subtitle="Search by title or JD text, then narrow the list by role demand."
              />

              <div className="search-row">
                <div className="search-input-wrap">
                  <Search size={18} />
                  <input
                    className="search-input"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search titles, skills, or responsibilities"
                    type="text"
                    value={query}
                  />
                </div>
                <PillTabs onChange={setFilter} options={filterOptions} value={filter} />
              </div>
            </Panel>
          </motion.div>

          {success ? (
            <motion.div variants={fadeUp} className="alert alert-success">
              <CheckCircle2 size={16} />
              {success}
            </motion.div>
          ) : null}
        </motion.section>

        {loading ? (
          <LoadingState label="Loading open positions…" />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            text="No jobs match your current search or filter. Adjust the filters or check back later."
            title="No roles found"
          />
        ) : (
          <motion.section initial="hidden" animate="visible" variants={stagger} className="card-grid">
            {filteredJobs.map(job => (
              <motion.div key={job.id} variants={fadeUp}>
                <Panel className="job-card">
                  <div className="job-card-head">
                    <div>
                      <h3 className="card-title">{job.title}</h3>
                      <p className="job-card-meta">Published {formatCompactDate(job.created_at)}</p>
                    </div>
                    <StatusBadge status="open" />
                  </div>

                  <p className="card-copy">
                    {job.description_text.length > 180
                      ? `${job.description_text.slice(0, 180)}…`
                      : job.description_text}
                  </p>

                  <div className="tag-row">
                    <span className="tag tone-muted">{job.applicant_count || 0} applicants</span>
                    <span className="tag tone-brand">AI interview ready</span>
                  </div>

                  <div className="job-card-footer">
                    <span className="mono-text">Role ID {job.id.slice(0, 8)}</span>
                    <button className="btn btn-primary btn-sm" onClick={() => setApplying(job)} type="button">
                      Apply now
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </Panel>
              </motion.div>
            ))}
          </motion.section>
        )}
      </main>

      <AnimatePresence>
        {applying ? (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={event => {
              if (event.target === event.currentTarget) {
                setApplying(null);
                setError('');
              }
            }}
          >
            <motion.div
              className="modal-card modal-card-wide"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="modal-head">
                <div>
                  <h2 className="modal-title">Apply to {applying.title}</h2>
                  <p className="modal-copy">
                    Upload your CV or paste the text. Once submitted, the recruiter can move you into the existing AI interview flow.
                  </p>
                </div>
                <StatusBadge tone="brand">Candidate submission</StatusBadge>
              </div>

              <div className="modal-grid">
                <Panel className="panel-muted">
                  <SectionHeader
                    eyebrow="Role snapshot"
                    title={applying.title}
                    subtitle="A cleaner summary before you submit your profile."
                  />
                  <div className="list-points">
                    <div className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>Applicant activity</strong>
                        <p className="card-copy">{applying.applicant_count || 0} candidate submissions currently on this role.</p>
                      </div>
                    </div>
                    <div className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>Next stage</strong>
                        <p className="card-copy">If shortlisted, the recruiter can invite you to the Mihna voice AI interview.</p>
                      </div>
                    </div>
                    <div className="list-point">
                      <span className="list-point-dot" />
                      <div>
                        <strong>JD preview</strong>
                        <p className="card-copy">
                          {applying.description_text.length > 220
                            ? `${applying.description_text.slice(0, 220)}…`
                            : applying.description_text}
                        </p>
                      </div>
                    </div>
                  </div>
                </Panel>

                <form className="form-grid" onSubmit={handleApply}>
                  <label className="form-group">
                    <span className="form-label">Upload CV</span>
                    <div className="form-file" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
                      <Upload size={18} />
                      <div>
                        <div className="table-heading">{cvFile ? cvFile.name : 'Drop a file or click to upload'}</div>
                        <div className="form-hint">Supports PDF, TXT, MD, and RTF files.</div>
                      </div>
                      <input
                        accept=".pdf,.txt,.md,.rtf"
                        onChange={event => setCvFile(event.target.files?.[0] || null)}
                        ref={fileRef}
                        type="file"
                      />
                    </div>
                  </label>

                  <label className="form-group">
                    <span className="form-label">Or paste CV text</span>
                    <textarea
                      className="form-textarea"
                      onChange={event => setCvText(event.target.value)}
                      placeholder="Paste your CV or resume here…"
                      value={cvText}
                    />
                  </label>

                  <Panel className="panel-muted">
                    <div className="tag-row">
                      <span className="tag tone-brand">
                        <FileText size={14} />
                        Application quality improves with detailed CV content
                      </span>
                    </div>
                  </Panel>

                  {error ? <div className="alert alert-error">{error}</div> : null}

                  <div className="hero-actions">
                    <button className="btn btn-secondary" onClick={() => setApplying(null)} type="button">
                      Cancel
                    </button>
                    <button className="btn btn-primary" type="submit">
                      Submit application
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
