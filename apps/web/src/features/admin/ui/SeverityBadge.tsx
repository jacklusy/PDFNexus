type Severity = 'info' | 'warning' | 'error' | 'critical' | 'low' | 'medium' | 'high';

type SeverityBadgeProps = {
  severity: Severity;
  label?: string;
};

const severityStyles: Record<Severity, string> = {
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  critical: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200 font-semibold',
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export function SeverityBadge({ severity, label }: SeverityBadgeProps) {
  const displayLabel = label || severity.charAt(0).toUpperCase() + severity.slice(1);
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${severityStyles[severity]}`}>
      {displayLabel}
    </span>
  );
}
