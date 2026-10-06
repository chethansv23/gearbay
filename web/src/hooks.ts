import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads data now and every `intervalMs`, pausing while the tab is hidden. */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    setData(null);
    refresh();
    const id = setInterval(() => document.visibilityState === 'visible' && refresh(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, refresh };
}
