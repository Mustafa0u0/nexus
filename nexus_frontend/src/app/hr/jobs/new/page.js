'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, LayoutDashboard, PlusCircle, Sparkles, Target } from 'lucide-react';
import { createJob } from '@/lib/api';
import { signOutUser, useStoredUser } from '@/lib/auth';
import { PageHeader, Panel, SectionHeader, TopNav } from '@/components/nexus-ui';

const navItems = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/hr/jobs/new', label: 'New Job', icon: PlusCircle },
];

export default function CreateJobPage() {
  const router = useRouter();
  const user = useStoredUser('hr');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Both title and description are required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createJob(user.id, title.trim(), description.trim());
      router.push('/hr/jobs');
    } catch (submissionError) {
      setError(submissionError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container">
      <TopNav
        activeHref="/hr/jobs/new"
        helperText="Recruiter workspace"
        items={navItems}
        onSignOut={() => signOutUser(router)}
        user={user}
      />

      <main className="page-shell stack-xl">
        <PageHeader
          eyebrow="New role brief"
          title="Create a polished recruiter-ready job brief"
          subtitle="The publishing flow stays the same, but the page now frames the JD as the start of a premium AI interview workflow."
        />

        <section className="split-grid">
          <Panel className="panel-brand sticky-panel stack-lg">
            <SectionHeader
              eyebrow="What Mihna uses"
              title={title.trim() || 'Role title preview'}
              subtitle="The content you enter here continues to power candidate applications and AI interview setup."
            />

            <div className="list-points">
              <div className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Recruiter workflow</strong>
                  <p className="card-copy">Once published, the role appears in the dashboard and jobs workspace for applicant review.</p>
                </div>
              </div>
              <div className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Candidate journey</strong>
                  <p className="card-copy">Candidates discover the role, upload their CV, and enter the existing interview pipeline after invitation.</p>
                </div>
              </div>
              <div className="list-point">
                <span className="list-point-dot" />
                <div>
                  <strong>Reporting output</strong>
                  <p className="card-copy">Interview scoring, transcripts, and recommendation reports remain tied to this role brief.</p>
                </div>
              </div>
            </div>

            <Panel className="panel-muted">
              <div className="tag-row">
                <span className="tag tone-brand">
                  <Sparkles size={14} />
                  Premium SaaS presentation
                </span>
                <span className="tag tone-success">
                  <Target size={14} />
                  Same backend logic
                </span>
              </div>
              <p className="card-copy" style={{ marginTop: '0.85rem' }}>
                Aim for clear responsibilities, required skills, and context. A stronger job brief improves candidate alignment and the quality of the AI interview prompt set.
              </p>
            </Panel>
          </Panel>

          <Panel className="stack-lg">
            <SectionHeader
              eyebrow="Role details"
              title="Publish a new job"
              subtitle="Recruiters keep the same creation flow with a more polished writing environment."
            />

            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="form-group">
                <span className="form-label">Job title</span>
                <input
                  autoFocus
                  className="form-input"
                  onChange={event => setTitle(event.target.value)}
                  placeholder="Senior Product Designer"
                  required
                  type="text"
                  value={title}
                />
              </label>

              <label className="form-group">
                <span className="form-label">Job description</span>
                <textarea
                  className="form-textarea"
                  onChange={event => setDescription(event.target.value)}
                  placeholder={`Describe the role, responsibilities, and required skills.\n\nInclude:\n• Core scope and ownership\n• Must-have skills and experience\n• Preferred background\n• Collaboration context`}
                  required
                  style={{ minHeight: '360px' }}
                  value={description}
                />
                <span className="form-hint">
                  Detailed JDs create stronger interview prompts and more defensible AI evaluation criteria.
                </span>
              </label>

              {error ? <div className="alert alert-error">{error}</div> : null}

              <div className="hero-actions">
                <Link className="btn btn-secondary" href="/hr/jobs">
                  Cancel
                </Link>
                <button className="btn btn-primary" disabled={loading} type="submit">
                  {loading ? 'Publishing role…' : 'Publish job'}
                  {!loading ? <ArrowRight size={16} /> : null}
                </button>
              </div>
            </form>
          </Panel>
        </section>
      </main>
    </div>
  );
}
