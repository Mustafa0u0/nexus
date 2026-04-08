'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, LogOut } from 'lucide-react';

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

export const softFade = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

export const dimensionMeta = [
  {
    key: 'role_alignment',
    label: 'Role Alignment',
    shortLabel: 'Alignment',
    weight: 10,
    description: 'Fit between prior experience and the role requirements.',
  },
  {
    key: 'technical_depth',
    label: 'Technical Depth',
    shortLabel: 'Technical',
    weight: 10,
    description: 'Real hard-skill fluency, process understanding, and depth.',
  },
  {
    key: 'evidence_of_impact',
    label: 'Impact Evidence',
    shortLabel: 'Impact',
    weight: 10,
    description: 'Concrete outcomes, metrics, and ownership of results.',
  },
  {
    key: 'communication_clarity',
    label: 'Communication',
    shortLabel: 'Communication',
    weight: 10,
    description: 'Clarity, structure, and ease of understanding.',
  },
  {
    key: 'problem_solving',
    label: 'Problem Solving',
    shortLabel: 'Problem Solving',
    weight: 10,
    description: 'Reasoning quality, diagnosis, and resolution approach.',
  },
  {
    key: 'star_compliance',
    label: 'STAR Structure',
    shortLabel: 'STAR',
    weight: 10,
    description: 'Whether behavioral answers follow a strong STAR flow.',
  },
  {
    key: 'soft_skills',
    label: 'Soft Skills',
    shortLabel: 'Soft Skills',
    weight: 10,
    description: 'Teamwork, empathy, collaboration, and stakeholder handling.',
  },
  {
    key: 'adaptability',
    label: 'Adaptability',
    shortLabel: 'Adaptability',
    weight: 10,
    description: 'Learning speed, resilience, and comfort with ambiguity.',
  },
  {
    key: 'culture_fit',
    label: 'Culture Fit',
    shortLabel: 'Culture Fit',
    weight: 10,
    description: 'Alignment with the company mission, values, and style.',
  },
  {
    key: 'professionalism',
    label: 'Professionalism',
    shortLabel: 'Professionalism',
    weight: 10,
    description: 'Confidence, composure, and professional communication.',
  },
];

const badgeTone = {
  applied: 'info',
  invited: 'warning',
  interviewing: 'accent',
  completed: 'success',
  open: 'success',
  closed: 'muted',
  recommend: 'success',
  consider: 'warning',
  'do not recommend': 'danger',
};

function cx(...tokens) {
  return tokens.filter(Boolean).join(' ');
}

export function formatLongDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatCompactDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatScore(value, digits = 1) {
  if (Number.isNaN(Number(value)) || value == null) return '0.0';
  return Number(value).toFixed(digits);
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'NX';
}

export function getRecommendationTone(value = '') {
  return badgeTone[value.toLowerCase()] || 'muted';
}

export function normalizeDimensionScores(scores = {}) {
  return dimensionMeta.map(item => ({
    ...item,
    value: Number(scores[item.key] || 0),
  }));
}

export function BrandLockup({ subtle = false }) {
  return (
    <Link className={cx('navbar-brand', subtle && 'navbar-brand-subtle')} href="/">
      <span className="brand-mark-shell">
        <Image src="/mihna-logo.png" alt="Mihna" width={40} height={27} className="brand-mark-image" priority />
      </span>
      <span className="brand-copy">
        <span className="brand-wordmark">Mihna</span>
        <span className="brand-meta">AI Interview Platform</span>
      </span>
    </Link>
  );
}

export function TopNav({
  items = [],
  activeHref,
  user,
  helperText,
  action,
  rightSlot,
  onSignOut,
}) {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <BrandLockup />
        <div className="navbar-content">
          <nav className="navbar-nav">
            {items.map(item => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cx('navbar-link', activeHref === item.href && 'active')}
                >
                  {Icon ? <Icon size={15} /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="navbar-actions">
            {helperText ? <div className="navbar-helper">{helperText}</div> : null}
            {action || null}
            {rightSlot || null}
            {user ? (
              <div className="navbar-user">
                <div className="navbar-user-avatar">{getInitials(user.name)}</div>
                <div>
                  <div className="navbar-user-name">{user.name}</div>
                  <div className="navbar-user-role">{user.role === 'hr' ? 'Recruiter' : 'Candidate'}</div>
                </div>
              </div>
            ) : null}
            {onSignOut ? (
              <button className="btn btn-ghost btn-sm" onClick={onSignOut} type="button">
                <LogOut size={14} />
                <span className="hide-sm">Sign out</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  centered = false,
  compact = false,
}) {
  return (
    <div className={cx('page-header', centered && 'page-header-centered', compact && 'page-header-compact')}>
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow ? <div className="eyebrow eyebrow-small">{eyebrow}</div> : null}
        <h2 className="section-title">{title}</h2>
        {subtitle ? <p className="section-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({ className, children, tone = 'default' }) {
  return <div className={cx('panel', tone !== 'default' && `panel-${tone}`, className)}>{children}</div>;
}

export function MetricCard({ icon: Icon, label, value, detail, tone = 'brand', trend, progress }) {
  return (
    <Panel className="metric-card">
      <div className="metric-card-header">
        <div>
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
        {Icon ? (
          <div className={cx('metric-icon', `tone-${tone}`)}>
            <Icon size={18} />
          </div>
        ) : null}
      </div>
      {detail ? <div className="metric-detail">{detail}</div> : null}
      {typeof progress === 'number' ? <ProgressBar value={progress} /> : null}
      {trend ? <div className={cx('metric-trend', `tone-${tone}`)}>{trend}</div> : null}
    </Panel>
  );
}

export function StatusBadge({ status, children, tone }) {
  const badgeToneClass = tone || badgeTone[String(status).toLowerCase()] || 'muted';
  return <span className={cx('status-badge', `tone-${badgeToneClass}`)}>{children || status}</span>;
}

export function ProgressBar({ value, max = 100, tone = 'brand' }) {
  const width = Math.max(0, Math.min((value / max) * 100, 100));
  return (
    <div className="progress-track">
      <div className={cx('progress-fill', `tone-${tone}`)} style={{ width: `${width}%` }} />
    </div>
  );
}

export function PillTabs({ options, value, onChange }) {
  return (
    <div className="pill-tabs" role="tablist" aria-label="Filter tabs">
      {options.map(option => (
        <button
          key={option.value}
          className={cx('pill-tab', value === option.value && 'active')}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ScoreDonut({ value, max = 5, label, sublabel }) {
  const safeValue = Math.max(0, Math.min(value, max));
  const angle = (safeValue / max) * 360;
  return (
    <div className="score-donut-wrap">
      <div className="score-donut" style={{ '--score-angle': `${angle}deg` }}>
        <div className="score-donut-inner">
          <div className="score-donut-value">{formatScore(safeValue)}</div>
          <div className="score-donut-max">/ {max}</div>
        </div>
      </div>
      {label ? <div className="score-donut-label">{label}</div> : null}
      {sublabel ? <div className="score-donut-sublabel">{sublabel}</div> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action, className }) {
  return (
    <Panel className={cx('empty-state', className)}>
      {Icon ? (
        <div className="empty-state-icon">
          <Icon size={24} />
        </div>
      ) : null}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-text">{text}</p>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </Panel>
  );
}

export function LoadingState({ label = 'Loading workspace…', className }) {
  return (
    <div className={cx('loading-state', className)}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function InterviewTranscript({ speaker, text }) {
  return (
    <Panel className="transcript-panel">
      <div className="transcript-label">{speaker}</div>
      <div className="transcript-text">{text}</div>
    </Panel>
  );
}

export function SecondaryLink({ href, children }) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowRight size={14} />
    </Link>
  );
}
