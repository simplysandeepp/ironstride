import { useCallback, useEffect, useState } from 'react'
import { runAutoBackup, type AutoBackupOptions, type AutoBackupStatus } from './autoBackup.ts'
import { realAutoBackupDeps } from './autoBackupRuntime.ts'

/**
 * Backs up when the app opens and again whenever it is left or hidden. There is no timer:
 * a web app is not run by the phone while it is closed.
 */
export function useAutoBackup(active: boolean) {
  const [status, setStatus] = useState<AutoBackupStatus>()

  // For a tap (such as "Allow backups"), where the browser may ask for folder access.
  const run = useCallback(async (options?: AutoBackupOptions) => {
    const result = await runAutoBackup(realAutoBackupDeps(), options)
    setStatus(result)
    return result
  }, [])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const check = async () => {
      const result = await runAutoBackup(realAutoBackupDeps())
      if (!cancelled) setStatus(result)
    }
    void check()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void check()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active])

  return { status, run }
}
