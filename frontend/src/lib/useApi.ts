import { useCallback, useEffect, useRef, useState } from "react";
import { api, RequestError } from "../api/client";

interface State<T> {
  data: T | null;
  error: RequestError | null;
  loading: boolean;
}

/** Fetch on mount / when `path` changes. Returns data, error, loading, reload. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: path !== null,
  });
  const reloadRef = useRef(0);

  const load = useCallback(() => {
    if (path === null) return;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    api<T>(path, { signal: ctrl.signal })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        setState({
          data: null,
          error:
            err instanceof RequestError
              ? err
              : new RequestError(0, undefined, String(err)),
          loading: false,
        });
      });
    return () => ctrl.abort();
  }, [path]);

  useEffect(() => load(), [load, reloadRef.current]);

  const reload = useCallback(() => {
    reloadRef.current += 1;
    load();
  }, [load]);

  return { ...state, reload };
}

interface MutationState {
  loading: boolean;
  error: RequestError | null;
}

export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [state, setState] = useState<MutationState>({
    loading: false,
    error: null,
  });

  const run = useCallback(
    async (...args: TArgs): Promise<TResult | undefined> => {
      setState({ loading: true, error: null });
      try {
        const result = await fn(...args);
        setState({ loading: false, error: null });
        return result;
      } catch (err) {
        setState({
          loading: false,
          error:
            err instanceof RequestError
              ? err
              : new RequestError(0, undefined, String(err)),
        });
        return undefined;
      }
    },
    [fn],
  );

  return { run, ...state };
}
