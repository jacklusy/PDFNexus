'use client';

import { useEffect, useRef, useState } from 'react';
import type { ToolFile } from './ToolWorkbench';
import { consumeToolHandoff } from './toolHandoff';

function toToolFile(file: File): ToolFile {
  return {
    id: `handoff-${file.name}-${file.size}-${Date.now()}`,
    file,
    name: file.name,
    size: file.size,
  };
}

/**
 * On mount, consume a workspace→tool PDF handoff into ToolWorkbench files
 * and optional page-range string.
 */
export function useToolHandoff(options?: {
  onPages?: (pages: string) => void;
}): {
  files: ToolFile[];
  setFiles: React.Dispatch<React.SetStateAction<ToolFile[]>>;
  handoffReady: boolean;
} {
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [handoffReady, setHandoffReady] = useState(false);
  const onPagesRef = useRef(options?.onPages);
  onPagesRef.current = options?.onPages;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handoff = await consumeToolHandoff();
        if (cancelled || !handoff) {
          if (!cancelled) setHandoffReady(true);
          return;
        }
        setFiles([toToolFile(handoff.file)]);
        if (handoff.pages?.trim()) {
          onPagesRef.current?.(handoff.pages.trim());
        }
      } catch {
        // ignore restore failures — user can still upload
      } finally {
        if (!cancelled) setHandoffReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { files, setFiles, handoffReady };
}
