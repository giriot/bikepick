export default function Loading() {
  return (
    <div className="container-xl grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-line border-t-brand-600" />
        <p className="mt-5 text-sm font-medium">Loading…</p>
        <p className="mt-1.5 text-[12.5px] text-ink-mute">
          If this continues, your internet connection may be slow.
        </p>
      </div>
    </div>
  );
}
