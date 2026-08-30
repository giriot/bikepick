'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="container-xl grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Something went wrong</h1>
        <p className="mt-3 text-sm text-ink-mute">
          The page could not be rendered. Existing data has not been changed.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={reset} className="btn-primary">Try again</button>
          <Link href="/" className="btn-outline">Homepage</Link>
        </div>
      </div>
    </div>
  );
}
