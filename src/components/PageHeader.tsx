import { Monitor, Moon, Settings, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Theme } from '../hooks/useTheme.ts'

const THEME_ICON = { dark: Moon, light: Sun, system: Monitor } as const

type Props = { title: string; theme: Theme; onCycleTheme: () => void }

export function PageHeader({ title, theme, onCycleTheme }: Props) {
  const Icon = THEME_ICON[theme]
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <div className="header-actions">
        <Link to="/settings" aria-label="Settings">
          <Settings aria-hidden="true" size={20} />
        </Link>
        <button
          type="button"
          className="theme-toggle"
          onClick={onCycleTheme}
          aria-label={`Theme: ${theme}. Tap to change`}
        >
          <Icon aria-hidden="true" size={20} />
        </button>
      </div>
    </header>
  )
}
