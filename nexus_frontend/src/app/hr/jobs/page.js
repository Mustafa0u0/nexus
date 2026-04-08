'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Filter,
  LayoutDashboard,
  PlusCircle,
  Search,
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
  PillTabs,
  ProgressBar,
  SectionHeader,
  StatusBadge,
  TopNav,
  formatCompactDate,
} from '@/components/nexus-ui';

const navItems = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/hr/jobs/new', label: 'New Job', icon: PlusCircle },
];

const filterOptions = [
  { value: 'all', label: 'All roles' },
  { value: 'open', label: 'Open roles' },
  { value: 'active', label: 'Needs review' },
];

export default function HRJobsPage() {
  const router = useRouter();
  const user = useStoredUser('hr');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

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
      if (filter === 'open') return job.status === 'open';
      if (filter === 'active') return (job.applicant_count || 0) > 0;
      return true;
    });

  const maxApplicants = Math.max(...jobs.map(job => job.applicant_count || 0), 1);

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
          eyebrow="Jobs workspace"
          title="All recruiter job briefs in one premium view"
          subtitle="A dedicated jobs page with stronger filtering, clearer tables, and faster navigation into applicant review."
          actions={
            <div className="page-actions">
              <Link className="btn btn-primary" href="/hr/jobs/new">
                Create job
                <ArrowRight size={16} />
              </Link>
            </div>
          }
        />

        {loading ? (
          <LoadingState label="Loading job briefs…" />
        ) : (
          <>
            <section className="metrics-grid">
              <MetricCard
                detail="All roles currently published in the recruiter workspace."
                icon={BriefcaseBusiness}
                label="Roles"
                value={jobs.length}
              />
              <MetricCard
                detail="Open roles recruiters can still source against."
                icon={Filter}
                label="Open"
                tone="brand"
                value={jobs.filter(job => job.status === 'open').length}
              />
              <MetricCard
                detail="Roles with incoming candidate activity."
                icon={Users}
                label="Needs review"
                tone="warning"
                value={jobs.filter(job => (job.applicant_count || 0) > 0).length}
              />
              <MetricCard
                detail="Total candidate volume flowing into your jobs."
                icon={Search}
                label="Applicants"
                tone="success"
                value={jobs.reduce((sum, job) => sum + (job.applicant_count || 0), 0)}
              />
            </section>

            <Panel className="panel-brand stack-lg">
              <SectionHeader
                eyebrow="Filter jobs"
                title={`${filteredJobs.length} matching role${filteredJobs.length === 1 ? '' : 's'}`}
                subtitle="Use search and filters to move directly into the roles that need action."
              />
              <div className="search-row">
                <div className="search-input-wrap">
                  <Search size={18} />
                  <input
                    className="search-input"
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Search roles by title or description"
                    type="text"
                    value={query}
                  />
                </div>
                <PillTabs onChange={setFilter} options={filterOptions} value={filter} />
              </div>
            </Panel>

            {filteredJobs.length === 0 ? (
              <EmptyState
                icon={BriefcaseBusiness}
                text="No jobs match the current search or filter."
                title="No matching roles"
              />
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Applicants</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map(job => (
                      <tr key={job.id}>
                        <td>
                          <div className="table-cell-stack">
                            <div>
                              <div className="table-heading">{job.title}</div>
                              <div className="table-copy">
                                {job.description_text.length > 110
                                  ? `${job.description_text.slice(0, 110)}…`
                                  : job.description_text}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusBadge status={job.status} />
                        </td>
                        <td>
                          <div className="stack-md">
                            <span className="bar-value">{job.applicant_count || 0} applicants</span>
                            <ProgressBar max={maxApplicants} value={job.applicant_count || 0} />
                          </div>
                        </td>
                        <td>
                          <span className="mono-text">{formatCompactDate(job.created_at)}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link className="btn btn-secondary btn-sm" href={`/hr/jobs/${job.id}`}>
                              Open role
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
