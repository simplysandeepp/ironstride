import { useState } from 'react'
import { useSwState } from '../hooks/useSwState.ts'

/** Shown when a new version is waiting. Nothing reloads until the user chooses. */
export function UpdatePrompt() {
  const { needRefresh, applyUpdate } = useSwState()
  const [dismissed, setDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)

  if (!needRefresh || dismissed || !applyUpdate) return null

  async function update() {
    if (updating || !applyUpdate) return
    setUpdating(true)
    try {
      await applyUpdate()
    } catch {
      // If applying fails the current version keeps working; let the user retry.
      setUpdating(false)
    }
  }

  return (
    <div className="update-prompt" role="status">
      <p>
        <strong>Update available.</strong> Refresh when you are between sessions. Your logs are not
        affected.
      </p>
      <div className="form-actions">
        <button type="button" className="primary" onClick={() => void update()} disabled={updating}>
          Refresh now
        </button>
        <button type="button" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  )
}
