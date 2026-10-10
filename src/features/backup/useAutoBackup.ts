import { useCallback, useEffect, useRef, useState } from 'react'
import { runAutoBackup, type AutoBackupOptions, type AutoBackupStatus } from './autoBackup.ts'
import { realAutoBackupDeps } from './autoBackupRuntime.ts'

/** Asks the browser to protect stored data from clean-up. Never throws; the answer is not needed. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/**
 * Backs up when the app opens and again whenever it is left or hidden. There is no timer:
 * a web app is not run by the phone while it is closed.
 */
export function useAutoBackup(active: boolean) {
  const [status, setStatus] = useState<AutoBackupStatus>()
  // True once the browser has been asked and still did not give access.
  const [declined, setDeclined] = useState(false)
  const asking = useRef<Promise<AutoBackupStatus>>(undefined)

  // For a tap (such as "Allow backups"), where the browser may ask for folder access.
  // Two taps at once share one prompt.
  const run = useCallback((options?: AutoBackupOptions) => {
    if (options?.requestPermission && asking.current) return asking.current
    const job = runAutoBackup(realAutoBackupDeps(), options).then((result) => {
      if (options?.requestPermission) setDeclined(result === 'needs-permission')
      setStatus(result)
      return result
    })
    if (options?.requestPermission) {
      asking.current = job
      void job.finally(() => (asking.current = undefined))
    }
    return job
  }, [])

  // Ask the browser to keep this app's data and not clear it when the phone is short on space.
  useEffect(() => {
    if (active) void requestPersistentStorage()
  }, [active])

  // Browsers only show the folder prompt after a tap, so use the first touch anywhere in the
  // app, once, instead of waiting for the person to find a button.
  useEffect(() => {
    if (status !== 'needs-permission') return
    const onGesture = () => void run({ requestPermission: true })
    const options = { once: true, capture: true } as const
    document.addEventListener('pointerup', onGesture, options)
    document.addEventListener('keydown', onGesture, options)
    return () => {
      document.removeEventListener('pointerup', onGesture, options)
      document.removeEventListener('keydown', onGesture, options)
    }
  }, [status, run])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const check = async (options?: AutoBackupOptions) => {
      const result = await runAutoBackup(realAutoBackupDeps(), options)
      if (!cancelled) setStatus(result)
    }
    // Every open backs up, however recently the last one ran; leaving the app is rate-limited.
    void check({ ignoreRecent: true })
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])

  return { status, run, declined }
}
