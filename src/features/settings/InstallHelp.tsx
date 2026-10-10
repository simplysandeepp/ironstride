import { useSwState } from '../../hooks/useSwState.ts'

export function InstallHelp() {
  const { offlineReady } = useSwState()
  return (
    <section className="card" aria-labelledby="install-heading">
      <h2 id="install-heading">Install on your phone</h2>
      <ol className="steps">
        <li>Open this site in Chrome (or another Android browser) over HTTPS.</li>
        <li>
          Open the browser menu and choose &quot;Install app&quot; or &quot;Add to Home
          screen&quot;.
        </li>
        <li>Confirm. The IronStride icon appears on your home screen.</li>
      </ol>
      <p className="helper">
        The exact menu wording differs by browser, and only you can approve the install; a website
        cannot install itself.
      </p>
      <p className="helper">
        {offlineReady
          ? 'Ready to work offline.'
          : 'After the first full load online, the app also opens offline.'}{' '}
        Your logs are stored on this device only. Clearing site data in the browser deletes them, so
        export a backup regularly.
      </p>
    </section>
  )
}
