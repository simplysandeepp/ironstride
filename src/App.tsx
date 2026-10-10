import { useLiveQuery } from 'dexie-react-hooks'
import { Route, Routes, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './app/navigation.ts'
import { NutritionScreen, ProgressScreen } from './app/screens.tsx'
import { BottomNavigation } from './components/BottomNavigation.tsx'
import { PageHeader } from './components/PageHeader.tsx'
import { repositories } from './db/repositories.ts'
import { GymScreen } from './features/gym/GymScreen.tsx'
import { SessionScreen } from './features/gym/SessionScreen.tsx'
import { RunLogScreen } from './features/run/RunLogScreen.tsx'
import { RunScreen } from './features/run/RunScreen.tsx'
import { OnboardingScreen } from './features/settings/OnboardingScreen.tsx'
import { TodayScreen } from './features/today/TodayScreen.tsx'
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
      : pathname.startsWith('/gym/session')
        ? 'Workout'
        : pathname === '/run/log'
          ? 'Log run'
          : (NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'IronStride')

  return (
    <div className="app-shell">
      <PageHeader title={title} theme={theme} onCycleTheme={cycleTheme} />
      <main className="page-body">
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/gym" element={<GymScreen />} />
          <Route path="/gym/session/:id" element={<SessionScreen />} />
          <Route path="/run" element={<RunScreen />} />
          <Route path="/run/log" element={<RunLogScreen />} />
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
