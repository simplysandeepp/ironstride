import { useLiveQuery } from 'dexie-react-hooks'
import { Route, Routes, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './app/navigation.ts'
import {
  GymScreen,
  NutritionScreen,
  ProgressScreen,
  RunScreen,
  TodayScreen,
} from './app/screens.tsx'
import { BottomNavigation } from './components/BottomNavigation.tsx'
import { PageHeader } from './components/PageHeader.tsx'
import { repositories } from './db/repositories.ts'
import { OnboardingScreen } from './features/settings/OnboardingScreen.tsx'
import { SettingsScreen } from './features/settings/SettingsScreen.tsx'
import { useTheme } from './hooks/useTheme.ts'

export default function App() {
  const { theme, cycleTheme } = useTheme()
  const { pathname } = useLocation()
  const settings = useLiveQuery(() => repositories.settings.get())

  if (!settings) return null // first read of local storage; avoids flashing onboarding
  if (!settings.onboardingCompleted) return <OnboardingScreen />

  const title =
    pathname === '/settings'
      ? 'Settings'
      : (NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'IronStride')

  return (
    <div className="app-shell">
      <PageHeader title={title} theme={theme} onCycleTheme={cycleTheme} />
      <main className="page-body">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/gym" element={<GymScreen />} />
          <Route path="/run" element={<RunScreen />} />
          <Route path="/nutrition" element={<NutritionScreen />} />
          <Route path="/progress" element={<ProgressScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<TodayScreen />} />
        </Routes>
      </main>
      <BottomNavigation />
    </div>
  )
}
