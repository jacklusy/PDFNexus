'use client';

type DateRangePickerProps = {
  value: number;
  onChange: (days: number) => void;
  options?: number[];
};

export function DateRangePicker({ value, onChange, options = [7, 30, 90] }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-[var(--color-ink)]">Period:</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      >
        {options.map((days) => (
          <option key={days} value={days}>
            Last {days} days
          </option>
        ))}
      </select>
    </div>
  );
}
