import { Loader2 } from 'lucide-react';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2 className="w-8 h-8 text-[var(--color-accent)] animate-spin mb-4" />
      <p className="text-sm text-[var(--color-muted)]">{message}</p>
    </div>
  );
}
