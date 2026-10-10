import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../app/navigation.ts'

export function BottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
        <NavLink key={path} to={path} end={path === '/'}>
          <Icon aria-hidden="true" size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
