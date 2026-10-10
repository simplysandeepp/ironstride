import { useRef, type KeyboardEvent, type ReactNode } from 'react'

export type TabDef = { id: string; label: string; domain?: string }

type Props = {
  tabs: readonly TabDef[]
  value: string
  onChange: (id: string) => void
  /** Accessible name of the tab group. */
  label: string
  idPrefix: string
}

/** An accessible tab list: arrow keys, Home and End move between tabs; only the active tab is in the tab order. */
export function Tabs({ tabs, value, onChange, label, idPrefix }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className="tabs">
      {tabs.map((tab, i) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            data-domain={tab.domain}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function TabPanel({
  id,
  idPrefix,
  domain,
  children,
}: {
  id: string
  idPrefix: string
  domain?: string
  children: ReactNode
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${id}`}
      aria-labelledby={`${idPrefix}-tab-${id}`}
      data-domain={domain}
      className="stack tab-panel"
    >
      {children}
    </div>
  )
}
