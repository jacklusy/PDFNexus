/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ColorOption {
  id: string;
  label: string;
  hex: string;
  // Card styling
  cardBorder: string;
  cardSelectedBorder: string;
  cardBadgeBg: string;
  cardBadgeText: string;
  cardAccentBar: string;
  cardBgLight: string;
  // Sidebar styling
  sidebarBg: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarBadge: string;
}

export const COLOR_PALETTE: ColorOption[] = [
  {
    id: 'black',
    label: 'Black',
    hex: '#0f172a',
    cardBorder: 'border-slate-300 hover:border-slate-800',
    cardSelectedBorder: 'border-slate-950 ring-2 ring-slate-300',
    cardBadgeBg: 'bg-slate-100 border-slate-300',
    cardBadgeText: 'text-slate-950 font-bold',
    cardAccentBar: 'bg-slate-950',
    cardBgLight: 'bg-slate-100/60',
    sidebarBg: 'bg-slate-900',
    sidebarBorder: 'border-slate-950',
    sidebarText: 'text-slate-100',
    sidebarBadge: 'bg-slate-950 text-white'
  },
  {
    id: 'charcoal',
    label: 'Dark Gray',
    hex: '#334155',
    cardBorder: 'border-slate-200 hover:border-slate-500',
    cardSelectedBorder: 'border-slate-700 ring-2 ring-slate-200',
    cardBadgeBg: 'bg-slate-100 border-slate-250',
    cardBadgeText: 'text-slate-800 font-bold',
    cardAccentBar: 'bg-slate-700',
    cardBgLight: 'bg-slate-100/50',
    sidebarBg: 'bg-slate-700',
    sidebarBorder: 'border-slate-800',
    sidebarText: 'text-slate-100',
    sidebarBadge: 'bg-slate-800 text-slate-100'
  },
  {
    id: 'navy',
    label: 'Navy Blue',
    hex: '#1e3a8a',
    cardBorder: 'border-slate-200 hover:border-blue-800',
    cardSelectedBorder: 'border-blue-900 ring-2 ring-blue-100',
    cardBadgeBg: 'bg-blue-50 border-blue-200',
    cardBadgeText: 'text-blue-950 font-bold',
    cardAccentBar: 'bg-blue-900',
    cardBgLight: 'bg-blue-50/50',
    sidebarBg: 'bg-blue-950',
    sidebarBorder: 'border-blue-900',
    sidebarText: 'text-blue-100',
    sidebarBadge: 'bg-blue-900 text-blue-100'
  },
  {
    id: 'indigo',
    label: 'Indigo',
    hex: '#6366f1',
    cardBorder: 'border-slate-200 hover:border-indigo-300',
    cardSelectedBorder: 'border-indigo-600 ring-2 ring-indigo-100',
    cardBadgeBg: 'bg-indigo-50 border-indigo-100/70',
    cardBadgeText: 'text-indigo-700',
    cardAccentBar: 'bg-indigo-600',
    cardBgLight: 'bg-indigo-50/40',
    sidebarBg: 'bg-indigo-50',
    sidebarBorder: 'border-indigo-200',
    sidebarText: 'text-indigo-600',
    sidebarBadge: 'bg-indigo-100 text-indigo-800'
  },
  {
    id: 'blue',
    label: 'Royal Blue',
    hex: '#2563eb',
    cardBorder: 'border-slate-200 hover:border-blue-300',
    cardSelectedBorder: 'border-blue-600 ring-2 ring-blue-100',
    cardBadgeBg: 'bg-blue-50 border-blue-100',
    cardBadgeText: 'text-blue-700',
    cardAccentBar: 'bg-blue-600',
    cardBgLight: 'bg-blue-50/40',
    sidebarBg: 'bg-blue-50',
    sidebarBorder: 'border-blue-200',
    sidebarText: 'text-blue-600',
    sidebarBadge: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'sky',
    label: 'Sky Blue',
    hex: '#0ea5e9',
    cardBorder: 'border-slate-200 hover:border-sky-300',
    cardSelectedBorder: 'border-sky-600 ring-2 ring-sky-100',
    cardBadgeBg: 'bg-sky-50 border-sky-100/70',
    cardBadgeText: 'text-sky-700',
    cardAccentBar: 'bg-sky-500',
    cardBgLight: 'bg-sky-50/40',
    sidebarBg: 'bg-sky-50',
    sidebarBorder: 'border-sky-200',
    sidebarText: 'text-sky-600',
    sidebarBadge: 'bg-sky-100 text-sky-800'
  },
  {
    id: 'cyan',
    label: 'Cool Cyan',
    hex: '#06b6d4',
    cardBorder: 'border-slate-200 hover:border-cyan-300',
    cardSelectedBorder: 'border-cyan-600 ring-2 ring-cyan-100',
    cardBadgeBg: 'bg-cyan-50 border-cyan-100/70',
    cardBadgeText: 'text-cyan-700',
    cardAccentBar: 'bg-cyan-600',
    cardBgLight: 'bg-cyan-50/40',
    sidebarBg: 'bg-cyan-50',
    sidebarBorder: 'border-cyan-200',
    sidebarText: 'text-cyan-600',
    sidebarBadge: 'bg-cyan-100 text-cyan-800'
  },
  {
    id: 'teal',
    label: 'Deep Teal',
    hex: '#14b8a6',
    cardBorder: 'border-slate-200 hover:border-teal-300',
    cardSelectedBorder: 'border-teal-600 ring-2 ring-teal-100',
    cardBadgeBg: 'bg-teal-50 border-teal-100/70',
    cardBadgeText: 'text-teal-700',
    cardAccentBar: 'bg-teal-600',
    cardBgLight: 'bg-teal-50/40',
    sidebarBg: 'bg-teal-50',
    sidebarBorder: 'border-teal-200',
    sidebarText: 'text-teal-600',
    sidebarBadge: 'bg-teal-100 text-teal-800'
  },
  {
    id: 'emerald',
    label: 'Emerald Green',
    hex: '#10b981',
    cardBorder: 'border-slate-200 hover:border-emerald-300',
    cardSelectedBorder: 'border-emerald-600 ring-2 ring-emerald-100',
    cardBadgeBg: 'bg-emerald-50 border-emerald-100/70',
    cardBadgeText: 'text-emerald-700',
    cardAccentBar: 'bg-emerald-600',
    cardBgLight: 'bg-emerald-50/40',
    sidebarBg: 'bg-emerald-50',
    sidebarBorder: 'border-emerald-200',
    sidebarText: 'text-emerald-600',
    sidebarBadge: 'bg-emerald-100 text-emerald-800'
  },
  {
    id: 'lime',
    label: 'Lime Green',
    hex: '#84cc16',
    cardBorder: 'border-slate-200 hover:border-lime-300',
    cardSelectedBorder: 'border-lime-600 ring-2 ring-lime-100',
    cardBadgeBg: 'bg-lime-50 border-lime-100/70',
    cardBadgeText: 'text-lime-800',
    cardAccentBar: 'bg-lime-500',
    cardBgLight: 'bg-lime-50/40',
    sidebarBg: 'bg-lime-50',
    sidebarBorder: 'border-lime-200',
    sidebarText: 'text-lime-700',
    sidebarBadge: 'bg-lime-100 text-lime-900'
  },
  {
    id: 'yellow',
    label: 'Golden Yellow',
    hex: '#eab308',
    cardBorder: 'border-slate-200 hover:border-yellow-300',
    cardSelectedBorder: 'border-yellow-600 ring-2 ring-yellow-100',
    cardBadgeBg: 'bg-yellow-50 border-yellow-200',
    cardBadgeText: 'text-yellow-900 font-bold',
    cardAccentBar: 'bg-yellow-500',
    cardBgLight: 'bg-yellow-50/40',
    sidebarBg: 'bg-yellow-50',
    sidebarBorder: 'border-yellow-200',
    sidebarText: 'text-yellow-700',
    sidebarBadge: 'bg-yellow-100 text-yellow-900'
  },
  {
    id: 'amber',
    label: 'Amber Orange',
    hex: '#f59e0b',
    cardBorder: 'border-slate-200 hover:border-amber-300',
    cardSelectedBorder: 'border-amber-600 ring-2 ring-amber-100',
    cardBadgeBg: 'bg-amber-50 border-amber-100/70',
    cardBadgeText: 'text-amber-850',
    cardAccentBar: 'bg-amber-500',
    cardBgLight: 'bg-amber-50/40',
    sidebarBg: 'bg-amber-50',
    sidebarBorder: 'border-amber-200',
    sidebarText: 'text-amber-600',
    sidebarBadge: 'bg-amber-100 text-amber-800'
  },
  {
    id: 'orange',
    label: 'Warm Orange',
    hex: '#f97316',
    cardBorder: 'border-slate-200 hover:border-orange-300',
    cardSelectedBorder: 'border-orange-600 ring-2 ring-orange-100',
    cardBadgeBg: 'bg-orange-50 border-orange-100/70',
    cardBadgeText: 'text-orange-850',
    cardAccentBar: 'bg-orange-500',
    cardBgLight: 'bg-orange-50/40',
    sidebarBg: 'bg-orange-50',
    sidebarBorder: 'border-orange-200',
    sidebarText: 'text-orange-600',
    sidebarBadge: 'bg-orange-100 text-orange-800'
  },
  {
    id: 'red',
    label: 'Crimson Red',
    hex: '#dc2626',
    cardBorder: 'border-slate-200 hover:border-red-300',
    cardSelectedBorder: 'border-red-600 ring-2 ring-red-100',
    cardBadgeBg: 'bg-red-50 border-red-100',
    cardBadgeText: 'text-red-700',
    cardAccentBar: 'bg-red-600',
    cardBgLight: 'bg-red-50/40',
    sidebarBg: 'bg-red-50',
    sidebarBorder: 'border-red-200',
    sidebarText: 'text-red-600',
    sidebarBadge: 'bg-red-100 text-red-800'
  },
  {
    id: 'rose',
    label: 'Rose Red',
    hex: '#f43f5e',
    cardBorder: 'border-slate-200 hover:border-rose-300',
    cardSelectedBorder: 'border-rose-600 ring-2 ring-rose-100',
    cardBadgeBg: 'bg-rose-50 border-rose-100/70',
    cardBadgeText: 'text-rose-700',
    cardAccentBar: 'bg-rose-600',
    cardBgLight: 'bg-rose-50/40',
    sidebarBg: 'bg-rose-50',
    sidebarBorder: 'border-rose-200',
    sidebarText: 'text-rose-600',
    sidebarBadge: 'bg-rose-100 text-rose-800'
  },
  {
    id: 'pink',
    label: 'Hot Pink',
    hex: '#ec4899',
    cardBorder: 'border-slate-200 hover:border-pink-300',
    cardSelectedBorder: 'border-pink-600 ring-2 ring-pink-100',
    cardBadgeBg: 'bg-pink-50 border-pink-100/70',
    cardBadgeText: 'text-pink-700',
    cardAccentBar: 'bg-pink-500',
    cardBgLight: 'bg-pink-50/40',
    sidebarBg: 'bg-pink-50',
    sidebarBorder: 'border-pink-200',
    sidebarText: 'text-pink-600',
    sidebarBadge: 'bg-pink-100 text-pink-800'
  },
  {
    id: 'fuchsia',
    label: 'Fuchsia Pink',
    hex: '#d946ef',
    cardBorder: 'border-slate-200 hover:border-fuchsia-300',
    cardSelectedBorder: 'border-fuchsia-600 ring-2 ring-fuchsia-100',
    cardBadgeBg: 'bg-fuchsia-50 border-fuchsia-100/70',
    cardBadgeText: 'text-fuchsia-700',
    cardAccentBar: 'bg-fuchsia-600',
    cardBgLight: 'bg-fuchsia-50/40',
    sidebarBg: 'bg-fuchsia-50',
    sidebarBorder: 'border-fuchsia-200',
    sidebarText: 'text-fuchsia-600',
    sidebarBadge: 'bg-fuchsia-100 text-fuchsia-800'
  },
  {
    id: 'purple',
    label: 'Deep Purple',
    hex: '#7e22ce',
    cardBorder: 'border-slate-200 hover:border-purple-300',
    cardSelectedBorder: 'border-purple-600 ring-2 ring-purple-100',
    cardBadgeBg: 'bg-purple-50 border-purple-100',
    cardBadgeText: 'text-purple-700',
    cardAccentBar: 'bg-purple-700',
    cardBgLight: 'bg-purple-50/40',
    sidebarBg: 'bg-purple-50',
    sidebarBorder: 'border-purple-200',
    sidebarText: 'text-purple-600',
    sidebarBadge: 'bg-purple-100 text-purple-800'
  },
  {
    id: 'violet',
    label: 'Violet Purple',
    hex: '#8b5cf6',
    cardBorder: 'border-slate-200 hover:border-violet-300',
    cardSelectedBorder: 'border-violet-600 ring-2 ring-violet-100',
    cardBadgeBg: 'bg-violet-50 border-violet-100/70',
    cardBadgeText: 'text-violet-700',
    cardAccentBar: 'bg-violet-600',
    cardBgLight: 'bg-violet-50/40',
    sidebarBg: 'bg-violet-50',
    sidebarBorder: 'border-violet-200',
    sidebarText: 'text-violet-600',
    sidebarBadge: 'bg-violet-100 text-violet-800'
  },
  {
    id: 'brown',
    label: 'Warm Brown',
    hex: '#78350f',
    cardBorder: 'border-slate-200 hover:border-amber-800',
    cardSelectedBorder: 'border-amber-900 ring-2 ring-amber-100',
    cardBadgeBg: 'bg-amber-100/60 border-amber-200',
    cardBadgeText: 'text-amber-950 font-bold',
    cardAccentBar: 'bg-amber-900',
    cardBgLight: 'bg-amber-100/30',
    sidebarBg: 'bg-amber-950',
    sidebarBorder: 'border-amber-900',
    sidebarText: 'text-amber-100',
    sidebarBadge: 'bg-amber-900 text-amber-100'
  }
];

export const DEFAULT_SLATE_COLOR: ColorOption = {
  id: 'slate',
  label: 'Slate Gray',
  hex: '#64748b',
  cardBorder: 'border-slate-200 hover:border-slate-300',
  cardSelectedBorder: 'border-slate-500 ring-2 ring-slate-100',
  cardBadgeBg: 'bg-slate-50 border-slate-150',
  cardBadgeText: 'text-slate-600',
  cardAccentBar: 'bg-slate-400',
  cardBgLight: 'bg-slate-50/40',
  sidebarBg: 'bg-slate-50',
  sidebarBorder: 'border-slate-200',
  sidebarText: 'text-slate-600',
  sidebarBadge: 'bg-slate-100 text-slate-800'
};

const PALETTE_MAP = new Map<string, ColorOption>(
  COLOR_PALETTE.map((c) => [c.id, c])
);

export function getColorOption(colorId?: string): ColorOption {
  if (!colorId) return COLOR_PALETTE[0];
  return PALETTE_MAP.get(colorId) || DEFAULT_SLATE_COLOR;
}

/**
 * Assigns visually distinct colors to a batch of new files being uploaded,
 * prioritizing colors not currently used by existing files.
 */
export function assignDistinctColors(existingColors: (string | undefined)[], count: number): string[] {
  if (count <= 0) return [];

  const usedSet = new Set(existingColors.filter((c): c is string => Boolean(c)));
  
  // Find all palette options not currently used
  const unusedOptions = COLOR_PALETTE.filter((c) => !usedSet.has(c.id));
  
  const assigned: string[] = [];
  const currentPool = [...unusedOptions];

  for (let i = 0; i < count; i++) {
    if (currentPool.length > 0) {
      // Pick next unused distinct color
      const picked = currentPool.shift()!;
      assigned.push(picked.id);
      usedSet.add(picked.id);
    } else {
      // If all palette colors are used, cycle through COLOR_PALETTE by offset
      const fallbackIndex = (usedSet.size + i) % COLOR_PALETTE.length;
      assigned.push(COLOR_PALETTE[fallbackIndex].id);
    }
  }

  return assigned;
}
