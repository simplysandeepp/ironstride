import { useEffect, useState } from 'react'

const format = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** A manual countdown. It never starts by itself and can be stopped at any time. */
export function RestTimer({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (remaining === null || remaining <= 0) return
    const id = setTimeout(() => setRemaining((r) => (r === null ? r : r - 1)), 1000)
    return () => clearTimeout(id)
  }, [remaining])

  if (remaining === null) {
    return (
      <button type="button" onClick={() => setRemaining(seconds)}>
        Start rest timer ({format(seconds)})
      </button>
    )
  }

  return (
    <div className="rest-timer" role="timer">
      <span className="metric-inline">{remaining > 0 ? format(remaining) : 'Rest over'}</span>
      <button type="button" onClick={() => setRemaining(null)}>
        {remaining > 0 ? 'Stop timer' : 'Dismiss'}
      </button>
    </div>
  )
}
