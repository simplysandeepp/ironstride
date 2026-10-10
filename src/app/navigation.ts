import { Apple, BarChart3, Dumbbell, Footprints, Home, type LucideIcon } from 'lucide-react'

export type NavItem = { path: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: readonly NavItem[] = [
  { path: '/', label: 'Today', icon: Home },
  { path: '/gym', label: 'Gym', icon: Dumbbell },
  { path: '/run', label: 'Run', icon: Footprints },
  { path: '/nutrition', label: 'Nutrition', icon: Apple },
  { path: '/progress', label: 'Progress', icon: BarChart3 },
]
