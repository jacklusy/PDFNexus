'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type TransferPhase =
  | 'idle'
  | 'preparing'
  | 'processing'
  | 'uploading'
  | 'finalizing'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed';

export interface TransferState {
  phase: TransferPhase;
  /** Human label for the current stage, e.g. "Compiling pages 3 / 10". */
  stageLabel: string;
  /** 0-100, or null when indeterminate. */
  percent: number | null;
  bytesSent?: number;
  totalBytes?: number;
  unitsDone?: number;
  unitsTotal?: number;
  unitLabel?: string;
  speedBps?: number;
  etaSeconds?: number | null;
  elapsedMs: number;
  error?: string | null;
  canCancel: boolean;
}

const ACTIVE_PHASES: ReadonlySet<TransferPhase> = new Set([
  'preparing',
  'processing',
  'uploading',
  'finalizing',
  'cancelling',
]);

const TERMINAL_PHASES: ReadonlySet<TransferPhase> = new Set([
  'cancelled',
  'completed',
  'failed',
]);

export function isActivePhase(phase: TransferPhase): boolean {
  return ACTIVE_PHASES.has(phase);
}

export function isTerminalPhase(phase: TransferPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

const INITIAL_STATE: TransferState = {
  phase: 'idle',
  stageLabel: '',
  percent: null,
  elapsedMs: 0,
  error: null,
  canCancel: false,
};

type Patch = Partial<TransferState> | ((prev: TransferState) => Partial<TransferState>);

export interface TransferOperation {
  state: TransferState;
  isActive: boolean;
  /** AbortSignal aborted when the operation is cancelled (for fetch-based flows). */
  signal: AbortSignal | null;
  begin: (init?: Partial<TransferState>) => AbortSignal;
  update: (patch: Patch) => void;
  succeed: (patch?: Partial<TransferState>) => void;
  fail: (error: string) => void;
  markCancelled: (patch?: Partial<TransferState>) => void;
  reset: () => void;
  /** Register the imperative abort for the current run (e.g. XHR upload handle). */
  setCancelHandler: (fn: (() => void) | null) => void;
  /** Move to `cancelling`, abort the signal, and invoke the registered handler. */
  requestCancel: () => void;
}

/**
 * State machine for a single transfer (merge/upload/export) with an elapsed
 * timer, a single-flight guard, and AbortController wiring. It is display-only:
 * callers drive real progress via `update`, and terminal states via
 * `succeed` / `fail` / `markCancelled`.
 */
export function useTransferOperation(): TransferOperation {
  const [state, setState] = useState<TransferState>(INITIAL_STATE);
  const controllerRef = useRef<AbortController | null>(null);
  const cancelHandlerRef = useRef<(() => void) | null>(null);
  const startTimeRef = useRef<number>(0);
  const activeRef = useRef(false);

  const update = useCallback((patch: Patch) => {
    setState((prev) => ({
      ...prev,
      ...(typeof patch === 'function' ? patch(prev) : patch),
    }));
  }, []);

  const begin = useCallback((init?: Partial<TransferState>): AbortSignal => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    startTimeRef.current = Date.now();
    activeRef.current = true;
    setState({
      ...INITIAL_STATE,
      phase: 'preparing',
      canCancel: true,
      ...init,
    });
    return controller.signal;
  }, []);

  const finishActive = useCallback(() => {
    activeRef.current = false;
    cancelHandlerRef.current = null;
  }, []);

  const succeed = useCallback(
    (patch?: Partial<TransferState>) => {
      finishActive();
      setState((prev) => ({
        ...prev,
        phase: 'completed',
        percent: prev.percent == null ? 100 : prev.percent,
        canCancel: false,
        error: null,
        ...patch,
      }));
    },
    [finishActive]
  );

  const fail = useCallback(
    (error: string) => {
      finishActive();
      setState((prev) => ({ ...prev, phase: 'failed', canCancel: false, error }));
    },
    [finishActive]
  );

  const markCancelled = useCallback(
    (patch?: Partial<TransferState>) => {
      finishActive();
      setState((prev) => ({
        ...prev,
        phase: 'cancelled',
        canCancel: false,
        ...patch,
      }));
    },
    [finishActive]
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    cancelHandlerRef.current = null;
    activeRef.current = false;
    setState(INITIAL_STATE);
  }, []);

  const setCancelHandler = useCallback((fn: (() => void) | null) => {
    cancelHandlerRef.current = fn;
  }, []);

  const requestCancel = useCallback(() => {
    if (!activeRef.current) return;
    setState((prev) => (prev.canCancel ? { ...prev, phase: 'cancelling' } : prev));
    controllerRef.current?.abort();
    cancelHandlerRef.current?.();
  }, []);

  // Elapsed timer ticks only while the operation is active.
  useEffect(() => {
    if (!isActivePhase(state.phase)) return;
    const id = window.setInterval(() => {
      setState((prev) =>
        isActivePhase(prev.phase)
          ? { ...prev, elapsedMs: Date.now() - startTimeRef.current }
          : prev
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [state.phase]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {
    state,
    isActive: isActivePhase(state.phase),
    signal: controllerRef.current?.signal ?? null,
    begin,
    update,
    succeed,
    fail,
    markCancelled,
    reset,
    setCancelHandler,
    requestCancel,
  };
}
