type Props = { title: string; children: string }

export function EmptyState({ title, children }: Props) {
  return (
    <section className="card empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </section>
  )
}
