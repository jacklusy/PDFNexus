import React from 'react';

/** Decorative SVG illustrations — theme-aware via currentColor / CSS vars. */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 360"
      className={className}
      role="img"
      aria-label="Illustration of PDF pages being arranged locally in the browser"
    >
      <defs>
        <linearGradient id="hx" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect
        x="40"
        y="40"
        width="400"
        height="280"
        rx="28"
        fill="var(--color-surface)"
        stroke="var(--color-border)"
      />
      <rect x="70" y="70" width="160" height="200" rx="12" fill="url(#hx)" opacity="0.25" />
      <rect
        x="90"
        y="90"
        width="140"
        height="180"
        rx="10"
        fill="var(--color-surface)"
        stroke="var(--color-accent)"
        strokeWidth="2"
        transform="rotate(-6 160 180)"
      />
      <rect
        x="180"
        y="80"
        width="150"
        height="190"
        rx="10"
        fill="var(--color-surface)"
        stroke="var(--color-chart-2)"
        strokeWidth="2"
        transform="rotate(4 255 175)"
      />
      <rect
        x="250"
        y="95"
        width="140"
        height="170"
        rx="10"
        fill="var(--color-accent-soft)"
        stroke="var(--color-accent)"
        strokeWidth="2"
      />
      <circle cx="380" cy="90" r="28" fill="var(--color-success-soft)" />
      <path
        d="M368 90 l8 8 16-18"
        fill="none"
        stroke="var(--color-success)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WorkflowIllustration({
  step,
  className,
}: {
  step: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      role="img"
      aria-hidden
    >
      <rect
        width="160"
        height="120"
        rx="16"
        fill="var(--color-accent-soft)"
      />
      {step === 1 ? (
        <>
          <rect x="30" y="28" width="100" height="64" rx="8" fill="var(--color-surface)" stroke="var(--color-accent)" />
          <path d="M80 20 v-8 M80 108 v8 M20 60 h-8 M148 60 h8" stroke="var(--color-accent)" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <rect x="24" y="30" width="48" height="60" rx="6" fill="var(--color-surface)" stroke="var(--color-accent)" />
          <rect x="86" y="30" width="48" height="60" rx="6" fill="var(--color-surface)" stroke="var(--color-chart-2)" />
          <path d="M78 60 h8" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <rect x="40" y="24" width="80" height="72" rx="8" fill="var(--color-surface)" stroke="var(--color-accent)" />
          <circle cx="80" cy="60" r="16" fill="var(--color-success-soft)" stroke="var(--color-success)" />
          <path d="M72 60 l6 6 12-14" fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  );
}

export function PrivacyIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 200"
      className={className}
      role="img"
      aria-label="Local processing stays on your device; optional cloud delivery"
    >
      <rect width="320" height="200" rx="20" fill="var(--color-surface-2)" />
      <rect x="36" y="40" width="120" height="120" rx="16" fill="var(--color-surface)" stroke="var(--color-border)" />
      <text x="96" y="108" textAnchor="middle" fontSize="12" fill="var(--color-muted)">
        Browser
      </text>
      <path
        d="M170 100 h40"
        stroke="var(--color-border)"
        strokeWidth="3"
        strokeDasharray="6 4"
      />
      <rect x="220" y="55" width="64" height="90" rx="12" fill="var(--color-accent-soft)" stroke="var(--color-accent)" />
      <path
        d="M252 88 v20 a12 12 0 0 0 0 0"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="3"
      />
      <circle cx="252" cy="100" r="10" fill="none" stroke="var(--color-accent)" strokeWidth="3" />
    </svg>
  );
}
