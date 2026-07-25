/**
 * CLS-safe ad reservation. Inactive until AdSense is enabled —
 * no third-party scripts are loaded.
 */
export interface AdSlotProps {
  slotId?: string;
  /** Fixed height to prevent layout shift */
  height?: number;
  className?: string;
  label?: string;
}

export function AdSlot({
  slotId = 'reserved',
  height = 90,
  className = '',
  label = 'Advertisement',
}: AdSlotProps) {
  return (
    <aside
      data-ad-slot={slotId}
      data-ad-status="inactive"
      aria-hidden="true"
      className={`mx-auto w-full max-w-[728px] overflow-hidden rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface-2)]/40 ${className}`}
      style={{ minHeight: height, height }}
    >
      <div className="flex h-full items-center justify-center text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-muted)]/50">
        {label}
      </div>
    </aside>
  );
}
