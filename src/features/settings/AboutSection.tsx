export function AboutSection() {
  return (
    <section className="card" aria-labelledby="about-heading">
      <h2 id="about-heading">About</h2>
      <p>IronStride v{__APP_VERSION__}</p>
      <p className="helper">
        Days, times and reminders use India Standard Time (IST), whatever your phone&apos;s time
        zone is set to.
      </p>
      <p className="helper">
        Updates replace the app files only. Your logs live in this browser&apos;s database and are
        never wiped by an update.
      </p>
    </section>
  )
}
