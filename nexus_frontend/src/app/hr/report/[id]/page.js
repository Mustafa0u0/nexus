'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  Code2,
  Download,
  LayoutDashboard,
  MessageSquare,
  Play,
  PlusCircle,
  Sparkles,
  Video,
} from 'lucide-react';
import {
  getApplication,
  getInterviewAnalyticsDownloadUrl,
  getInterviewAudioDownloadUrl,
  getInterviewBundleDownloadUrl,
  getInterviewReport,
  getInterviewReportDownloadUrl,
  getInterviewTranscriptDownloadUrl,
  getInterviewVideoDownloadUrl,
  getVideoUrl,
} from '@/lib/api';
import { signOutUser, useStoredUser } from '@/lib/auth';
import {
  LoadingState,
  PageHeader,
  Panel,
  PillTabs,
  ProgressBar,
  ScoreDonut,
  SectionHeader,
  StatusBadge,
  TopNav,
  formatCompactDate,
  formatScore,
  getRecommendationTone,
  normalizeDimensionScores,
} from '@/components/nexus-ui';

const navItems = [
  { href: '/hr', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/hr/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { href: '/hr/jobs/new', label: 'New Job', icon: PlusCircle },
];

const tabOptions = [
  { value: 'overview', label: 'Overview' },
  { value: 'questions', label: 'Question review' },
  { value: 'transcript', label: 'Transcript + JSON' },
];

export default function ReportPage() {
  const router = useRouter();
  const { id: appId } = useParams();
  const user = useStoredUser('hr');
  const [application, setApplication] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showVideo, setShowVideo] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    Promise.all([getApplication(appId), getInterviewReport(appId)])
      .then(([applicationData, reportData]) => {
        if (!mounted) return;
        setApplication(applicationData);
        setReport(reportData);
      })
      .catch(fetchError => {
        if (mounted) setError(fetchError.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [appId, user]);

  if (!user) return null;

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
          <LoadingState label="Loading evaluation report…" />
        </main>
      </div>
    );
  }

  if (error || !report || !application) {
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
          <Panel className="stack-lg">
            <div className="landing-role-icon">
              <AlertTriangle size={24} />
            </div>
            <PageHeader
              compact
              eyebrow="Report unavailable"
              subtitle={error || 'The report payload could not be loaded.'}
              title="Unable to load report"
            />
            <Link className="btn btn-secondary" href="/hr/jobs">
              Back to jobs
            </Link>
          </Panel>
        </main>
      </div>
    );
  }

  const recommendation = report.recommendation || {};
  const dimensionScores = normalizeDimensionScores(report.rubric_scores);
  const overallScore =
    typeof report.rubric_scores?.overall === 'number'
      ? report.rubric_scores.overall
      : dimensionScores.reduce((sum, item) => sum + item.value, 0) / Math.max(dimensionScores.length, 1);
  const recommendationTone = getRecommendationTone(recommendation.recommendation || '');
  const matchScore = report.gap_analysis?.match_score || 0;
  const transcriptDownloadUrl = getInterviewTranscriptDownloadUrl(appId);
  const analyticsDownloadUrl = getInterviewAnalyticsDownloadUrl(appId);
  const reportDownloadUrl = getInterviewReportDownloadUrl(appId);
  const bundleDownloadUrl = getInterviewBundleDownloadUrl(appId);
  const videoDownloadUrl = getInterviewVideoDownloadUrl(appId);
  const audioDownloadUrl = getInterviewAudioDownloadUrl(appId);
  const hasVideoDownload = Boolean(application.video_available || application.video_path);
  const hasAudioDownload = Boolean(application.audio_assets_available);

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
          eyebrow="Evaluation report"
          title={`${report.candidate?.name || application.employee_name || 'Candidate'} for ${application.job_title}`}
          subtitle={`Generated ${formatCompactDate(report.generated_at)}. This redesigned report keeps the same scoring, transcript, and recommendation payload while presenting it like an executive SaaS review.`}
          actions={
            <div className="page-actions">
              <StatusBadge tone={recommendationTone}>{recommendation.recommendation || 'Pending'}</StatusBadge>
              <Link className="btn btn-secondary" href={`/hr/jobs/${application.job_id}`}>
                Back to role
              </Link>
            </div>
          }
        />

        <section className="split-grid">
          <Panel className="report-hero stack-lg">
            <span className="eyebrow">
              <Sparkles size={14} />
              Executive summary
            </span>
            <div className="stack-md">
              <h2 className="section-title" style={{ marginTop: 0 }}>
                {recommendation.summary || 'Recommendation summary unavailable.'}
              </h2>
              <p className="section-subtitle">
                Candidate profile: {report.candidate?.summary || 'No candidate summary available.'}
              </p>
            </div>
            <div className="tag-row">
              <span className="tag tone-brand">{application.job_title}</span>
              <span className="tag tone-muted">{report.questions_answered || 0} questions answered</span>
              <span className="tag tone-success">{report.candidate?.experience_years || 0}+ years experience</span>
            </div>
          </Panel>

          <Panel className="stack-lg">
            <div className="card-toolbar">
              <div>
                <div className="preview-kicker">Hiring score</div>
                <div className="preview-title">Overall evaluation</div>
              </div>
              <StatusBadge tone={recommendationTone}>{recommendation.recommendation || 'Pending'}</StatusBadge>
            </div>
            <ScoreDonut
              label="Overall score"
              sublabel={`${recommendation.hiring_confidence?.toFixed(0) || 0}% recommendation confidence`}
              max={10}
              value={Number(overallScore)}
            />
          </Panel>
        </section>

        <section className="report-kpi-grid">
          <Panel>
            <div className="preview-kicker">Confidence</div>
            <div className="metric-value">{recommendation.hiring_confidence?.toFixed(0) || '0'}%</div>
            <p className="metric-detail">LLM-generated confidence in the recommendation.</p>
          </Panel>
          <Panel>
            <div className="preview-kicker">Match score</div>
            <div className="metric-value">{matchScore.toFixed(0)}%</div>
            <p className="metric-detail">Pre-interview alignment between CV and role brief.</p>
          </Panel>
          <Panel>
            <div className="preview-kicker">Question coverage</div>
            <div className="metric-value">
              {report.questions_answered || 0}/{report.total_questions || 0}
            </div>
            <p className="metric-detail">Interview questions completed by the candidate.</p>
          </Panel>
          <Panel>
            <div className="preview-kicker">Model</div>
            <div className="metric-value" style={{ fontSize: '1.55rem' }}>
              {report.model_info?.provider || 'AI'}
            </div>
            <p className="metric-detail">{report.model_info?.model || 'Provider metadata unavailable.'}</p>
          </Panel>
        </section>

        <Panel className="stack-lg">
          <div className="card-toolbar">
            <SectionHeader
              eyebrow="Exports"
              title="Download interview script, analytics, and media"
              subtitle="Use the bundle for the full handoff, or download individual assets separately."
            />
            <StatusBadge tone="brand">
              <Download size={14} />
              Export ready
            </StatusBadge>
          </div>
          <div className="tag-row">
            <span className="tag tone-muted">
              <MessageSquare size={14} />
              {report.transcript?.length || 0} transcript turns
            </span>
            <span className="tag tone-brand">
              <BarChart3 size={14} />
              {dimensionScores.length} analytics dimensions
            </span>
            {hasAudioDownload ? (
              <span className="tag tone-success">
                Audio package: {application.audio_clip_count || 0} files
              </span>
            ) : null}
            {hasVideoDownload ? (
              <span className="tag tone-success">
                <Video size={14} />
                Video available
              </span>
            ) : null}
          </div>
          <div className="page-actions">
            <a className="btn btn-primary btn-sm" href={bundleDownloadUrl}>
              <Download size={14} />
              Download full bundle
            </a>
            <a className="btn btn-secondary btn-sm" href={transcriptDownloadUrl}>
              <MessageSquare size={14} />
              Interview script
            </a>
            <a className="btn btn-secondary btn-sm" href={analyticsDownloadUrl}>
              <BarChart3 size={14} />
              Analytics JSON
            </a>
            <a className="btn btn-secondary btn-sm" href={reportDownloadUrl}>
              <Code2 size={14} />
              Report JSON
            </a>
            {hasAudioDownload ? (
              <a className="btn btn-secondary btn-sm" href={audioDownloadUrl}>
                <Sparkles size={14} />
                Audio package
              </a>
            ) : null}
            {hasVideoDownload ? (
              <a className="btn btn-secondary btn-sm" href={videoDownloadUrl}>
                <Video size={14} />
                Video file
              </a>
            ) : null}
          </div>
        </Panel>

        {hasVideoDownload ? (
          <Panel className="stack-lg">
            <div className="card-toolbar">
              <SectionHeader
                eyebrow="Interview recording"
                title="Video review"
                subtitle="Optional playback of the submitted interview recording."
              />
              <button className="btn btn-secondary btn-sm" onClick={() => setShowVideo(!showVideo)} type="button">
                {showVideo ? 'Hide video' : 'Play video'}
                <Play size={14} />
              </button>
            </div>
            {showVideo ? (
              <div className="webcam-preview">
                <video controls src={getVideoUrl(appId)} style={{ transform: 'none' }} />
              </div>
            ) : (
              <div className="tag-row">
                <span className="tag tone-muted">
                  <Video size={14} />
                  Video available
                </span>
              </div>
            )}
          </Panel>
        ) : null}

        <section className="stack-lg">
          <div className="card-toolbar">
            <SectionHeader
              eyebrow="Report workspace"
              title="Switch between summary, question-level review, and transcript detail"
              subtitle="The content stays the same, but the navigation is more explicit and executive-friendly."
            />
            <PillTabs onChange={setTab} options={tabOptions} value={tab} />
          </div>

          {tab === 'overview' ? (
            <div className="split-grid">
              <Panel className="stack-lg">
                <SectionHeader
                  eyebrow="Scoring breakdown"
                  title="Ten-dimension interview rubric"
                  subtitle="The updated NEXUS scoring framework, shown with the current 10-point scale and dimension-level evidence."
                />
                <div className="dimension-bars">
                  {dimensionScores.map(item => (
                    <div key={item.key} className="stack-md">
                      <div className="bar-row">
                        <span className="bar-label">{item.label}</span>
                        <span className="bar-value">
                          {formatScore(item.value)} / 10 • {item.weight}%
                        </span>
                      </div>
                      <ProgressBar max={10} value={item.value} />
                      <p className="card-copy" style={{ margin: 0 }}>
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="stack-lg">
                <Panel className="stack-lg">
                  <SectionHeader
                    eyebrow="Role alignment"
                    title="Pre-interview fit analysis"
                    subtitle="Alignment extracted from the stored gap analysis."
                  />
                  <div className="stack-md">
                    <div className="bar-row">
                      <span className="bar-label">Match score</span>
                      <span className="bar-value">{matchScore.toFixed(0)}%</span>
                    </div>
                    <ProgressBar value={matchScore} />
                  </div>
                  <div className="tag-row">
                    {(report.gap_analysis?.matched_skills || []).slice(0, 6).map(skill => (
                      <span key={skill} className="tag tone-success">
                        {skill}
                      </span>
                    ))}
                  </div>
                  {(report.gap_analysis?.missing_skills || []).length > 0 ? (
                    <div className="tag-row">
                      {report.gap_analysis.missing_skills.slice(0, 4).map(skill => (
                        <span key={skill} className="tag tone-warning">
                          Missing: {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Panel>

                <Panel className="stack-lg">
                  <SectionHeader
                    eyebrow="Strengths and concerns"
                    title="Executive talking points"
                    subtitle="Use these in recruiter debriefs and stakeholder reviews."
                  />
                  <div className="split-grid">
                    <div className="stack-md">
                      <div className="table-heading">Strengths</div>
                      <ul className="list-points">
                        {(recommendation.strengths || []).map(strength => (
                          <li key={strength} className="list-point">
                            <span className="list-point-dot" />
                            <div>{strength}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="stack-md">
                      <div className="table-heading">Areas for development</div>
                      <ul className="list-points">
                        {(recommendation.areas_for_development || []).map(area => (
                          <li key={area} className="list-point">
                            <span className="list-point-dot" />
                            <div>{area}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          ) : null}

          {tab === 'questions' ? (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Avg. score</th>
                    <th>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.per_question_scores || []).map(item => (
                    <tr key={item.question_id}>
                      <td>
                        <span className="mono-text">Q{item.question_id}</span>
                      </td>
                      <td>
                        <div className="table-heading">{item.question_text}</div>
                        <div className="table-copy">
                          {item.answer_text.length > 160 ? `${item.answer_text.slice(0, 160)}…` : item.answer_text}
                        </div>
                      </td>
                      <td>
                        <span className="bar-value">{formatScore(item.average_score)} / 10</span>
                      </td>
                      <td>
                        {item.needs_follow_up ? (
                          <StatusBadge tone="warning">{item.follow_up_reason || 'Follow-up suggested'}</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">Complete</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {tab === 'transcript' ? (
            <div className="split-grid">
              <Panel className="stack-lg">
                <SectionHeader
                  eyebrow="Conversation log"
                  title="Full transcript"
                  subtitle={`${report.transcript?.length || 0} turns captured in the interview session.`}
                />
                <div className="stack-md">
                  {(report.transcript || []).map((turn, index) => (
                    <div key={`${turn.role}-${index}`} className={`report-turn ${turn.role === 'assistant' ? 'assistant' : ''}`}>
                      <div className="preview-kicker">{turn.role === 'assistant' ? 'Mihna' : 'Candidate'}</div>
                      <div className="card-copy" style={{ marginTop: '0.4rem', color: 'var(--text-soft)' }}>
                        {turn.content}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="stack-lg">
                <SectionHeader
                  eyebrow="Technical detail"
                  title="Raw report JSON"
                  subtitle="For debugging, audits, and direct payload inspection."
                />
                <div className="tag-row">
                  <span className="tag tone-muted">
                    <Code2 size={14} />
                    Raw payload
                  </span>
                  <span className="tag tone-brand">
                    <MessageSquare size={14} />
                    Transcript included
                  </span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '1rem',
                    borderRadius: '20px',
                    background: 'rgba(15, 23, 42, 0.96)',
                    color: 'rgba(226, 232, 240, 0.92)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    overflow: 'auto',
                    maxHeight: '34rem',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(report, null, 2)}
                </pre>
              </Panel>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
