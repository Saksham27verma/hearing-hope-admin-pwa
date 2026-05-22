'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query as fsQuery,
  type Query,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/firebase/config';

export interface UseCollectionState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a Firestore collection with optional query constraints.
 *
 * - Returns `{ data, loading, error }` similar to a tiny react-query shape.
 * - Re-subscribes only when `path` or the serialized `constraints` change.
 * - Each document is augmented with `{ id }` from Firestore.
 */
export function useCollection<T = Record<string, unknown>>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  options: { enabled?: boolean } = {},
): UseCollectionState<T> {
  const enabled = options.enabled ?? true;
  const [state, setState] = useState<UseCollectionState<T>>({
    data: [],
    loading: !!path && enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled || !path || !db) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    let q: Query;
    try {
      q = constraints.length > 0 ? fsQuery(collection(db, path), ...constraints) : collection(db, path);
    } catch (err) {
      setState({ data: [], loading: false, error: err as Error });
      return;
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: T[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as T));
        setState({ data, loading: false, error: null });
      },
      (error) => {
        console.warn(`[useCollection:${path}] snapshot error:`, error);
        setState({ data: [], loading: false, error });
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled, JSON.stringify(constraints.map((c) => (c as any)._op || (c as any).type || ''))]);

  return state;
}
