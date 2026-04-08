'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  LayoutDashboard,
  PlusCircle,
  Sparkles,
  Users,
} from 'lucide-react';
import { listJobs } from '@/lib/api';
import { signOutUser, useStoredUser } from '@/lib/auth';
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  TopNav,
  fadeUp,
  formatCompactDate,
  stagger,
} from '@/components/nexus-ui';

const navItems = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/hr/jobs/new', label: 'New Job', icon: PlusCircle },
];

export default function HRDashboardPage() {
  const router = useRouter();
  const user = useStoredUser('hr');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    listJobs()
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

  if (loading) {
    return (
      <div className="page-container">
        <TopNav
          activeHref="/hr"
          helperText="Recruiter workspace"
          items={navItems}
          onSignOut={() => signOutUser(router)}
          user={user}
        />
        <main className="page-shell">
          <LoadingState label="Loading recruiter dashboard…" />
        </main>
      </div>
    );
  }

  const totalApplicants = jobs.reduce((sum, job) => sum + (job.applicant_count || 0), 0);
  const openRoles = jobs.filter(job => job.status === 'open');
  const rolesWithApplicants = jobs.filter(job => (job.applicant_count || 0) > 0);
  const averageApplicants = jobs.length ? (totalApplicants / jobs.length).toFixed(1) : '0.0';
  const topJobs = [...jobs].sort((a, b) => (b.applicant_count || 0) - (a.applicant_count || 0)).slice(0, 4);

  return (
    <div className="page-container">
      <TopNav
        activeHref="/hr"
        helperText="Recruiter workspace"
        items={navItems}
        onSignOut={() => signOutUser(router)}
        user={user}
      />

      <main className="page-shell stack-xl">
        <motion.section initial="hidden" animate="visible" variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <PageHeader
              eyebrow="Recruiter dashboard"
              title="Premium visibility across the hiring pipeline"
              subtitle="Every recruiter touchpoint now has clearer hierarchy, better pacing, and more credible decision support without changing the underlying workflow."
              actions={
                <div className="page-actions">
                  <Link className="btn btn-secondary" href="/hr/jobs">
                    View all jobs
                  </Link>
                  <Link className="btn btn-primary" href="/hr/jobs/new">
                    Post a new job
                    <ArrowRight size={16} />
                  </Link>
                </div>
              }
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <Panel className="dashboard-banner">
              <div className="dashboard-banner-copy">
                <span className="eyebrow">
                  <Sparkles size={14} />
                  Hiring command layer
                </span>
                <div>
                  <h2 className="section-title">A calmer recruiter workspace for faster decisions.</h2>
                  <p className="section-subtitle">
                    The new dashboard elevates role visibility, applicant volume, and reporting flow so you can guide hiring conversations with more confidence.
                  </p>
                </div>
                <div className="dashboard-banner-actions">
                  <StatusBadge tone="brand">{openRoles.length} open roles</StatusBadge>
                  <StatusBadge tone="success">{rolesWithApplicants.length} roles with applicants</StatusBadge>
                </div>
              </div>

              <Panel className="panel-muted">
                <SectionHeader
                  eyebrow="Recruiting focus"
                  title={topJobs[0]?.title || 'No jobs yet'}
                  subtitle={
                    topJobs[0]
                      ? `${topJobs[0].applicant_count || 0} applicant${topJobs[0].applicant_count === 1 ? '' : 's'} currently concentrated in your busiest role.`
                      : 'Create your first role to start building the pipeline.'
                  }
                />
                <div className="stack-md">
                  {topJobs.slice(0, 3).map(job => (
                    <div key={job.id} className="stack-md">
                      <div className="bar-row">
                        <span className="bar-label">{job.title}</span>
                        <span className="bar-value">{job.applicant_count || 0} applicants</span>
                      </div>
                      <ProgressBar max={Math.max(topJobs[0]?.applicant_count || 1, 1)} value={job.applicant_count || 0} />
                    </div>
                  ))}
                </div>
              </Panel>
            </Panel>
          </motion.div>
        </motion.section>

        <section className="metrics-grid">
          <MetricCard
            detail="All job briefs currently in the Mihna recruiter workspace."
            icon={BriefcaseBusiness}
            label="Total roles"
            value={jobs.length}
          />
          <MetricCard
            detail="Candidates who have entered your pipeline through applications."
            icon={Users}
            label="Applicants"
            tone="accent"
            value={totalApplicants}
          />
          <MetricCard
            detail="Average demand per role, helpful for spotting concentration."
            icon={BarChart3}
            label="Avg. applicants"
            tone="warning"
            value={averageApplicants}
          />
          <MetricCard
            detail="Roles already generating candidate activity and ready for next-step review."
            icon={Activity}
            label="Active roles"
            tone="success"
            value={rolesWithApplicants.length}
          />
        </section>

        <section className="split-grid">
          <Panel>
            <SectionHeader
              eyebrow="Hiring cadence"
              title="How the new UX speeds recruiter flow"
              subtitle="The same Mihna functionality now has stronger direction and better decision framing."
            />
            <ul className="list-points">
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Role-first visibility</strong>
                  <p className="card-copy">Important jobs stand out faster, so recruiters know where to spend time first.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Pipeline legibility</strong>
                  <p className="card-copy">Applicants, interview readiness, and report review all feel more deliberate and easier to scan.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Executive credibility</strong>
                  <p className="card-copy">The new surfaces make demos and hiring review meetings feel closer to a production SaaS product.</p>
                </div>
              </li>
            </ul>
          </Panel>

          <Panel className="panel-brand">
            <SectionHeader
              eyebrow="Fast actions"
              title="Keep recruiter momentum high"
              subtitle="Move directly into your most common workflows."
            />
            <div className="stack-md">
              <Link className="btn btn-primary" href="/hr/jobs/new">
                Post a new job
                <ArrowRight size={16} />
              </Link>
              <Link className="btn btn-secondary" href="/hr/jobs">
                Review all job postings
              </Link>
            </div>
          </Panel>
        </section>

        <section className="stack-lg">
          <SectionHeader
            eyebrow="Recent roles"
            title="Role briefs in motion"
            subtitle="A polished card layout for your most recent job postings."
            actions={
              <Link className="btn btn-secondary btn-sm" href="/hr/jobs">
                See full jobs table
              </Link>
            }
          />

          {jobs.length === 0 ? (
            <EmptyState
              action={
                <Link className="btn btn-primary" href="/hr/jobs/new">
                  Create first role
                  <ArrowRight size={16} />
                </Link>
              }
              icon={BriefcaseBusiness}
              text="Create a job brief to start receiving applications and AI interview reports."
              title="No jobs posted yet"
            />
          ) : (
            <div className="card-grid">
              {jobs.slice(0, 3).map(job => (
                <Panel key={job.id} className="job-card">
                  <div className="job-card-head">
                    <div>
                      <h3 className="card-title">{job.title}</h3>
                      <p className="job-card-meta">Created {formatCompactDate(job.created_at)}</p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="card-copy">
                    {job.description_text.length > 190 ? `${job.description_text.slice(0, 190)}…` : job.description_text}
                  </p>
                  <div className="tag-row">
                    <span className="tag tone-muted">{job.applicant_count || 0} applicants</span>
                    <span className="tag tone-brand">AI report workflow enabled</span>
                  </div>
                  <div className="job-card-footer">
                    <span className="mono-text">Role ID {job.id.slice(0, 8)}</span>
                    <Link className="btn btn-primary btn-sm" href={`/hr/jobs/${job.id}`}>
                      Open role
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
