'use client';

import { useState } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { AdminThemeProvider } from './ThemeContext';

/**
 * MUI Next.js App Router SSR cache (Emotion).
 * Pattern from https://github.com/mui/material-ui/tree/master/examples/material-ui-nextjs-ts
 */
export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const c = createCache({ key: 'mui' });
    c.compat = true;
    const prevInsert = c.insert;
    let inserted: string[] = [];
    c.insert = (...args) => {
      const serialized = args[1];
      if (c.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return prevInsert(...args);
    };
    const flushImpl = () => {
      const prev = inserted;
      inserted = [];
      return prev;
    };
    return { cache: c, flush: flushImpl };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      styles += cache.inserted[name];
    }
    return (
      <style
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <AdminThemeProvider>{children}</AdminThemeProvider>
    </CacheProvider>
  );
}
