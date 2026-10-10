import type { SwState } from './swState.ts'

/**
 * How long after opening the app a waiting update may be applied without asking. After this the
 * user is probably in the middle of something, so they get the tap-to-refresh banner instead.
 */
export const AUTO_UPDATE_WINDOW_MS = 60_000

export type AutoUpdateContext = {
  /** Milliseconds since the page was opened. */
  uptimeMs: number
  /** A workout that was started and not finished. */
  sessionInProgress: boolean
  /** The user is typing in a field right now. */
  typing: boolean
}

/** Reload only when nothing the user is doing can be lost. */
export function canAutoUpdate({ uptimeMs, sessionInProgress, typing }: AutoUpdateContext): boolean {
  return uptimeMs <= AUTO_UPDATE_WINDOW_MS && !sessionInProgress && !typing
}

export type AutoUpdateDeps = {
  uptimeMs: () => number
  sessionInProgress: () => Promise<boolean>
  typing: () => boolean
  apply: () => Promise<void>
  setState: (patch: Partial<SwState>) => void
}

export type AutoUpdateOutcome = 'applied' | 'prompted' | 'failed'

/**
 * A new version is waiting. Apply it quietly when that is safe; otherwise (or if applying fails)
 * show the banner so the user can choose the moment. If unsure whether a workout is open, ask.
 */
export async function handleUpdateAvailable(deps: AutoUpdateDeps): Promise<AutoUpdateOutcome> {
  const busy = await deps.sessionInProgress().catch(() => true)
  const safe = canAutoUpdate({
    uptimeMs: deps.uptimeMs(),
    sessionInProgress: busy,
    typing: deps.typing(),
  })
  if (!safe) {
    deps.setState({ needRefresh: true })
    return 'prompted'
  }
  deps.setState({ autoUpdating: true })
  try {
    await deps.apply()
    return 'applied'
  } catch {
    deps.setState({ autoUpdating: false, needRefresh: true })
    return 'failed'
  }
}

/** True while a text field, text area or dropdown has the keyboard. */
export function isTypingInField(doc: Pick<Document, 'activeElement'> = document): boolean {
  const el = doc.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (el as HTMLInputElement).type
  return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type)
}
