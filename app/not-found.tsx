import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="container-xl grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-600">404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">We couldn&apos;t find that page</h1>
        <p className="mt-3 text-sm text-ink-mute">
          The page may have moved, or the product may not be published yet.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-primary">Go to homepage</Link>
          <Link href="/bikes" className="btn-outline">Browse bikes</Link>
          <Link href="/used-bikes" className="btn-outline">Used bikes</Link>
        </div>
      </div>
    </div>
  );
}
