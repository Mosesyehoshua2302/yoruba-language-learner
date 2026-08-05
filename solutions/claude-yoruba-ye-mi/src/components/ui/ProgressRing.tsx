import type { ReactNode } from 'react';

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  className = '',
  ringClassName = 'text-forest-500 dark:text-forest-400',
  trackClassName = 'text-ink-200/80 dark:text-ink-700/80',
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  ringClassName?: string;
  trackClassName?: string;
  children?: ReactNode;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped);
  return (
    <div className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className={trackClassName}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`ring-progress ${ringClassName}`}
        />
      </svg>
      {children !== undefined && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  );
}
