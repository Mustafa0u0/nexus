'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  PlusCircle,
  Send,
  Users,
} from 'lucide-react';
import { getJob, getJobApplications, inviteToInterview } from '@/lib/api';
import { signOutUser, useStoredUser } from '@/lib/auth';
import {
  EmptyState,
  LoadingState,
  MetricCard,
  PageHeader,
  Panel,
  PillTabs,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  TopNav,
  formatLongDate,
} from '@/components/nexus-ui';

const navItems = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/hr/jobs/new', label: 'New Job', icon: PlusCircle },
];

const tabs = [
  { value: 'applicants', label: 'Applicants' },
  { value: 'brief', label: 'Role brief' },
];

export default function HRJobDetailPage() {
  const router = useRouter();
  const { id: jobId } = useParams();
  const user = useStoredUser('hr');
  const [job, setJob] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(null);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState('applicants');

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    Promise.all([getJob(jobId), getJobApplications(jobId)])
      .then(([jobData, applicationData]) => {
        if (!mounted) return;
        setJob(jobData);
        setApplications(applicationData);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [jobId, user]);

  if (!user) return null;

  async function handleInvite(applicationId) {
    setInviting(applicationId);
    setMessage('');

    try {
      await inviteToInterview(applicationId);
      const refreshed = await getJobApplications(jobId);
      setApplications(refreshed);
      setMessage('Interview invitation sent successfully.');
    } catch (inviteError) {
      setMessage(inviteError.message);
    } finally {
      setInviting(null);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <TopNav
          activeHref="/hr/jobs"
          helperText="Recruiter workspace"
          items={navItems}
          onSignOut={() => signOutUser(router)}
          user={user}
        />
        <main className="page-shell">
          <LoadingState label="Loading role detail…" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-container">
        <TopNav
          activeHref="/hr/jobs"
          helperText="Recruiter workspace"
          items={navItems}
          onSignOut={() => signOutUser(router)}
          user={user}
        />
        <main className="page-shell">
          <EmptyState icon={ClipboardList} text="The role could not be loaded." title="Role unavailable" />
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

  const maxStatusValue = Math.max(...Object.values(counts), 1);

  return (
    <div className="page-container">
      <TopNav
        activeHref="/hr/jobs"
        helperText="Recruiter workspace"
        items={navItems}
        onSignOut={() => signOutUser(router)}
        user={user}
      />

      <main className="page-shell stack-xl">
        <PageHeader
          eyebrow="Role detail"
          title={job.title}
          subtitle={`Published ${formatLongDate(job.created_at)}. Review applicants, invite interviews, and move into report analysis from one place.`}
          actions={
            <div className="page-actions">
              <StatusBadge status={job.status} />
              <Link className="btn btn-secondary" href="/hr/jobs">
                Back to jobs
              </Link>
            </div>
          }
        />

        {message ? (
          <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-error'}`}>{message}</div>
        ) : null}

        <section className="metrics-grid">
          <MetricCard detail="Candidates newly submitted and awaiting review." icon={Users} label="Applied" value={counts.applied} />
          <MetricCard detail="Candidates invited to the AI voice interview." icon={Send} label="Invited" tone="warning" value={counts.invited} />
          <MetricCard detail="Candidates currently inside the interview session." icon={Loader2} label="Interviewing" tone="accent" value={counts.interviewing} />
          <MetricCard detail="Candidates with reports ready for recruiter review." icon={ClipboardList} label="Completed" tone="success" value={counts.completed} />
        </section>

        <section className="split-grid">
          <Panel>
            <SectionHeader
              eyebrow="Hiring funnel"
              title="Application stage distribution"
              subtitle="A faster way to see where recruiter action is needed on this specific role."
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
                    <span className="bar-value">{value}</span>
                  </div>
                  <ProgressBar max={maxStatusValue} tone={tone} value={Number(value)} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="panel-brand">
            <SectionHeader
              eyebrow="Role context"
              title="What this page is optimized for"
              subtitle="The redesign keeps the original recruiter actions but gives them stronger context and visual confidence."
            />
            <ul className="list-points">
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Invite faster</strong>
                  <p className="card-copy">Candidates ready for interview are more obvious from the applicant table and status system.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Review reports sooner</strong>
                  <p className="card-copy">Completed interviews now surface as the highest-value action with a direct path into the report page.</p>
                </div>
              </li>
              <li className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Keep JD context nearby</strong>
                  <p className="card-copy">Recruiters can reference the role brief without leaving the application review workflow.</p>
                </div>
              </li>
            </ul>
          </Panel>
        </section>

        <section className="stack-lg">
          <div className="card-toolbar">
            <SectionHeader
              eyebrow="Role workspace"
              title="Applicants and role brief"
              subtitle="Switch between recruiter actions and the job description without leaving the page."
            />
            <PillTabs onChange={setTab} options={tabs} value={tab} />
          </div>

          {tab === 'applicants' ? (
            applications.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                text="No candidates have applied to this role yet."
                title="No applicants yet"
              />
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Candidate</th>
                      <th>Applied</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(application => (
                      <tr key={application.id}>
                        <td>
                          <div className="table-cell-stack">
                            <div>
                              <div className="table-heading">{application.employee_name || 'Unknown candidate'}</div>
                              <div className="table-copy">
                                {application.cv_text.length > 110
                                  ? `${application.cv_text.slice(0, 110)}…`
                                  : application.cv_text}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="mono-text">{formatLongDate(application.created_at)}</span>
                        </td>
                        <td>
                          <StatusBadge status={application.status} />
                        </td>
                        <td>
                          <div className="table-actions">
                            {application.status === 'applied' ? (
                              <button
                                className="btn btn-primary btn-sm"
                                disabled={inviting === application.id}
                                onClick={() => handleInvite(application.id)}
                                type="button"
                              >
                                {inviting === application.id ? (
                                  <>
                                    <Loader2 size={14} />
                                    Sending…
                                  </>
                                ) : (
                                  <>
                                    <Send size={14} />
                                    Invite to interview
                                  </>
                                )}
                              </button>
                            ) : null}

                            {application.status === 'completed' ? (
                              <Link className="btn btn-success btn-sm" href={`/hr/report/${application.id}`}>
                                View report
                                <ArrowRight size={14} />
                              </Link>
                            ) : null}

                            {application.status === 'invited' ? <span className="tag tone-warning">Awaiting candidate</span> : null}
                            {application.status === 'interviewing' ? <span className="tag tone-accent">Interview in progress</span> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <Panel className="stack-lg">
              <SectionHeader
                eyebrow="Job description"
                title="Role brief"
                subtitle="The original JD content remains unchanged. This view just gives it a cleaner reading surface."
              />
              <p className="card-copy" style={{ whiteSpace: 'pre-wrap' }}>
                {job.description_text}
              </p>
            </Panel>
          )}
        </section>
      </main>
    </div>
  );
}
