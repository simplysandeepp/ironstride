import { Apple, BarChart3, Dumbbell, Footprints, Home, type LucideIcon } from 'lucide-react'

export type Domain = 'brand' | 'gym' | 'run' | 'nutrition' | 'body'

export type NavItem = { path: string; label: string; icon: LucideIcon; domain: Domain }

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Today', icon: Home, domain: 'brand' },
  { path: '/gym', label: 'Gym', icon: Dumbbell, domain: 'gym' },
  { path: '/run', label: 'Run', icon: Footprints, domain: 'run' },
  { path: '/nutrition', label: 'Nutrition', icon: Apple, domain: 'nutrition' },
  { path: '/progress', label: 'Progress', icon: BarChart3, domain: 'body' },
]

/** The colour area of a route, so a screen and its nav item share one colour. */
export function domainForPath(pathname: string): Domain {
  if (pathname.startsWith('/gym')) return 'gym'
  if (pathname.startsWith('/run')) return 'run'
  if (pathname.startsWith('/nutrition')) return 'nutrition'
  if (pathname.startsWith('/progress')) return 'body'
  return 'brand'
}
