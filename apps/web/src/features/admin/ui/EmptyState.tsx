import { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="p-4 bg-[var(--color-surface-2)] rounded-full mb-4">
        <Icon className="w-8 h-8 text-[var(--color-muted)]" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-muted)] text-center max-w-md">{description}</p>
    </div>
  );
}
