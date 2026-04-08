'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Mic,
  Search,
  Sparkles,
  Timer,
} from 'lucide-react';
import { getEmployeeApplications } from '@/lib/api';
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
  { href: '/employee', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/employee/jobs', label: 'Jobs', icon: Search },
];

export default function EmployeeDashboard() {
  const router = useRouter();
  const user = useStoredUser('employee');
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    getEmployeeApplications(user.id)
      .then(data => {
        if (mounted) setApplications(data);
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
          activeHref="/employee"
          helperText="Candidate workspace"
          items={navItems}
          onSignOut={() => signOutUser(router)}
          user={user}
        />
        <main className="page-shell">
          <LoadingState label="Loading your candidate dashboard…" />
        </main>
      </div>
    );
  }

  const counts = {
    applied: applications.filter(app => app.status === 'applied').length,
    invited: applications.filter(app => app.status === 'invited').length,
    interviewing: applications.filter(app => app.status === 'interviewing').length,
    completed: applications.filter(app => app.status === 'completed').length,
  };

  const totalApplications = applications.length;
  const completionRate = totalApplications ? Math.round((counts.completed / totalApplications) * 100) : 0;
  const activeInterview = applications.find(app => app.status === 'interviewing') || applications.find(app => app.status === 'invited');
  const recentApplications = applications.slice(0, 3);

  return (
    <div className="page-container">
      <TopNav
        activeHref="/employee"
        helperText="Candidate workspace"
        items={navItems}
        onSignOut={() => signOutUser(router)}
        user={user}
      />

      <main className="page-shell stack-xl">
        <motion.section initial="hidden" animate="visible" variants={stagger} className="stack-lg">
          <motion.div variants={fadeUp}>
            <PageHeader
              eyebrow="Candidate portal"
              title={`Welcome back, ${user.name}`}
              subtitle="Track every application, understand your next step, and move into AI interviews with more confidence."
              actions={
                <div className="page-actions">
                  <Link className="btn btn-primary" href="/employee/jobs">
                    Browse open jobs
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
                  Application command center
                </span>
                <div>
                  <h2 className="section-title">Stay close to every interview milestone.</h2>
                  <p className="section-subtitle">
                    The candidate dashboard is now designed to reduce uncertainty: clearer statuses, calmer call-to-actions, and a tighter view of where you stand.
                  </p>
                </div>
                <div className="dashboard-banner-actions">
                  {activeInterview ? (
                    <Link className="btn btn-primary" href={`/employee/interview/${activeInterview.id}`}>
                      {activeInterview.status === 'interviewing' ? 'Continue interview' : 'Start interview'}
                      <Mic size={16} />
                    </Link>
                  ) : (
                    <Link className="btn btn-secondary" href="/employee/jobs">
                      Find new roles
                      <Search size={16} />
                    </Link>
                  )}
                  <div className="tag-row">
                    <StatusBadge status={`${completionRate}% completion`} tone="brand">
                      {completionRate}% completion
                    </StatusBadge>
                    <StatusBadge status={`${counts.invited + counts.interviewing} active interview steps`} tone="accent">
                      {counts.invited + counts.interviewing} active interview steps
                    </StatusBadge>
                  </div>
                </div>
              </div>

              <Panel className="panel-muted">
                <SectionHeader
                  eyebrow="Next focus"
                  title={activeInterview ? activeInterview.job_title : 'No active interview yet'}
                  subtitle={
                    activeInterview
                      ? activeInterview.status === 'interviewing'
                        ? 'Your AI interview is in progress and can be resumed from the same session.'
                        : 'You have an invitation ready. Launch the interview when you are in a quiet place.'
                      : 'Browse new roles and submit your CV to move into the interview pipeline.'
                  }
                />
                <div className="timeline-list">
                  <div className="timeline-item">
                    <span className="timeline-dot" />
                    <div>
                      <h4>Applications sent</h4>
                      <p>{counts.applied} currently under review by recruiting teams.</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-dot" />
                    <div>
                      <h4>Interview momentum</h4>
                      <p>{counts.invited + counts.interviewing} role{counts.invited + counts.interviewing === 1 ? '' : 's'} are ready for AI interview action.</p>
                    </div>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-dot" />
                    <div>
                      <h4>Completed interviews</h4>
                      <p>{counts.completed} submission{counts.completed === 1 ? '' : 's'} are now waiting on recruiter review.</p>
                    </div>
                  </div>
                </div>
              </Panel>
            </Panel>
          </motion.div>
        </motion.section>

        <motion.section initial="hidden" animate="visible" variants={stagger} className="metrics-grid">
          <motion.div variants={fadeUp}>
            <MetricCard
              detail="Across all roles in your candidate workspace."
              icon={BriefcaseBusiness}
              label="Applications"
              value={totalApplications}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              detail="Invitations ready for your voice AI interview."
              icon={Mic}
              label="Invited"
              tone="accent"
              value={counts.invited}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              detail="Sessions already underway and ready to resume."
              icon={Timer}
              label="In progress"
              tone="warning"
              value={counts.interviewing}
            />
          </motion.div>
          <motion.div variants={fadeUp}>
            <MetricCard
              detail="Interviews submitted back to recruiters for review."
              icon={CheckCircle2}
              label="Completed"
              tone="success"
              value={counts.completed}
            />
          </motion.div>
        </motion.section>

        <section className="split-grid">
          <Panel>
            <SectionHeader
              eyebrow="Application momentum"
              title="Pipeline visibility"
              subtitle="Every state is clearer, so you know exactly what to expect next."
            />
            <div className="stack-md">
              {[
                ['Applied', counts.applied, 'brand'],
                ['Invited', counts.invited, 'warning'],
                ['Interviewing', counts.interviewing, 'accent'],
                ['Completed', counts.completed, 'success'],
              ].map(([label, value, tone]) => (
                <div key={label} className="stack-md">
                  <div className="bar-row">
                    <span className="bar-label">{label}</span>
                    <span className="bar-value">
                      {value} / {Math.max(totalApplications, 1)}
                    </span>
                  </div>
                  <ProgressBar max={Math.max(totalApplications, 1)} tone={tone} value={Number(value)} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="panel-brand">
            <SectionHeader
              eyebrow="Readiness"
              title="What makes the new experience calmer"
              subtitle="The redesign reduces cognitive load before the interview and keeps the next call-to-action obvious."
            />
            <ul className="list-points">
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Clear application state</strong>
                  <p className="card-copy">You can distinguish between recruiter review, interview readiness, live session, and completion at a glance.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Focused interview prep</strong>
                  <p className="card-copy">Interview CTAs only appear where action is relevant, which keeps the dashboard from feeling noisy.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Candidate trust signals</strong>
                  <p className="card-copy">Soft surfaces, confident type, and smoother hierarchy make the product feel more credible to applicants.</p>
                </div>
              </li>
            </ul>
          </Panel>
        </section>

        <section className="stack-lg">
          <SectionHeader
            eyebrow="My applications"
            title="Recent role activity"
            subtitle="Each application card is now optimized around the decision you need to make next."
            actions={
              <Link className="btn btn-secondary btn-sm" href="/employee/jobs">
                Browse more roles
              </Link>
            }
          />

          {recentApplications.length === 0 ? (
            <EmptyState
              action={
                <Link className="btn btn-primary" href="/employee/jobs">
                  Browse jobs
                  <ArrowRight size={16} />
                </Link>
              }
              icon={ClipboardList}
              text="You have not submitted any applications yet. Start with the open roles page and upload your CV when you find a fit."
              title="No applications yet"
            />
          ) : (
            <div className="card-grid">
              {recentApplications.map(application => (
                <Panel key={application.id} className="application-card">
                  <div className="application-card-head">
                    <div>
                      <h3 className="card-title">{application.job_title}</h3>
                      <p className="application-card-meta">Applied {formatCompactDate(application.created_at)}</p>
                    </div>
                    <StatusBadge status={application.status} />
                  </div>

                  <p className="card-copy">
                    {application.status === 'completed'
                      ? 'Your AI interview is complete. The recruiting team can now review your scoring breakdown and transcript.'
                      : application.status === 'interviewing'
                        ? 'Your interview session is active and can be resumed from where you left off.'
                        : application.status === 'invited'
                          ? 'You have been invited to the AI interview. Pick a calm environment before you begin.'
                          : 'Your CV has been submitted and the role is currently being reviewed by the recruiter.'}
                  </p>

                  <div className="application-card-footer">
                    <div className="tag-row">
                      <StatusBadge tone="muted">{application.id.slice(0, 8)}</StatusBadge>
                    </div>
                    {application.status === 'invited' || application.status === 'interviewing' ? (
                      <Link className="btn btn-primary btn-sm" href={`/employee/interview/${application.id}`}>
                        {application.status === 'interviewing' ? 'Resume interview' : 'Begin interview'}
                        <Mic size={14} />
                      </Link>
                    ) : application.status === 'completed' ? (
                      <span className="tag tone-success">Awaiting recruiter review</span>
                    ) : (
                      <span className="tag tone-brand">Under review</span>
                    )}
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
