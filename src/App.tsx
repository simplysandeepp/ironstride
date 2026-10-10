import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { NAV_ITEMS } from './app/navigation.ts'
import { BottomNavigation } from './components/BottomNavigation.tsx'
import { AutoBackupBanner } from './features/backup/AutoBackupBanner.tsx'
import { OfflineIndicator } from './components/OfflineIndicator.tsx'
import { UpdatePrompt } from './components/UpdatePrompt.tsx'
import { PageHeader } from './components/PageHeader.tsx'
import { repositories } from './db/repositories.ts'
import { GymScreen } from './features/gym/GymScreen.tsx'
import { SessionScreen } from './features/gym/SessionScreen.tsx'
import { FoodFormScreen } from './features/nutrition/FoodFormScreen.tsx'
import { NutritionScreen } from './features/nutrition/NutritionScreen.tsx'
import { RunLogScreen } from './features/run/RunLogScreen.tsx'
import { RunScreen } from './features/run/RunScreen.tsx'
import { ReminderBanner } from './features/reminders/ReminderBanner.tsx'
import { OnboardingScreen } from './features/settings/OnboardingScreen.tsx'
import { TodayScreen } from './features/today/TodayScreen.tsx'
import { useTheme } from './hooks/useTheme.ts'
import { requestPersistentStorage } from './pwa/storage.ts'

// Heavier, less-visited screens load on demand so the first open stays fast.
const PlanScreen = lazy(() =>
  import('./features/plan/PlanScreen.tsx').then((m) => ({ default: m.PlanScreen })),
)
const ProgressScreen = lazy(() =>
  import('./features/progress/ProgressScreen.tsx').then((m) => ({ default: m.ProgressScreen })),
)
const SettingsScreen = lazy(() =>
  import('./features/settings/SettingsScreen.tsx').then((m) => ({ default: m.SettingsScreen })),
)

export default function App() {
  const { theme, cycleTheme } = useTheme()
  const { pathname } = useLocation()
  const settings = useLiveQuery(() => repositories.settings.get())
  const onboarded = Boolean(settings?.onboardingCompleted)

  // Ask once, quietly, that the browser keep our data when space is tight.
  useEffect(() => {
    if (onboarded) void requestPersistentStorage()
  }, [onboarded])

  if (!settings) return null // first read of local storage; avoids flashing onboarding
  if (!settings.onboardingCompleted) return <OnboardingScreen />

  const title =
    pathname === '/settings'
      ? 'Settings'
      : pathname === '/plan'
        ? 'Full plan'
        : pathname.startsWith('/gym/session')
          ? 'Workout'
          : pathname === '/run/log'
            ? 'Log run'
            : pathname === '/nutrition/food'
              ? 'Add food'
              : (NAV_ITEMS.find((item) => item.path === pathname)?.label ?? 'IronStride')

  return (
    <div className="app-shell">
      <PageHeader title={title} theme={theme} onCycleTheme={cycleTheme} />
      <OfflineIndicator />
      <UpdatePrompt />
      <ReminderBanner />
      <AutoBackupBanner active />
      <main className="page-body">
        <Suspense fallback={<p className="helper">Loading…</p>}>
          <Routes>
            <Route path="/" element={<TodayScreen />} />
            <Route path="/gym" element={<GymScreen />} />
            <Route path="/gym/session/:id" element={<SessionScreen />} />
            <Route path="/run" element={<RunScreen />} />
            <Route path="/run/log" element={<RunLogScreen />} />
            <Route path="/nutrition" element={<NutritionScreen />} />
            <Route path="/nutrition/food" element={<FoodFormScreen />} />
            <Route path="/progress" element={<ProgressScreen />} />
            <Route path="/plan" element={<PlanScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<TodayScreen />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNavigation />
    </div>
  )
}
