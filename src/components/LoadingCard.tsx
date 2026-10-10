/** A calm placeholder while local data is read, instead of a bare "Loading" card. */
export function LoadingCard({ label = 'Loading' }: { label?: string }) {
  return (
    <section className="card skeleton-card" role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="skeleton w60" />
      <div className="skeleton" />
      <div className="skeleton w80" />
    </section>
  )
}
