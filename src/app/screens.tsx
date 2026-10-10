import { EmptyState } from '../components/EmptyState.tsx'

// Placeholder screens; each is replaced by its feature module in a later PR.
export const TodayScreen = () => (
  <EmptyState title="Nothing planned yet">Your daily plan will appear here.</EmptyState>
)
export const GymScreen = () => (
  <EmptyState title="No gym sessions yet">Your gym programme will appear here.</EmptyState>
)
export const RunScreen = () => (
  <EmptyState title="No runs yet">Your running schedule will appear here.</EmptyState>
)
export const NutritionScreen = () => (
  <EmptyState title="No meals logged">Food, water and supplements will appear here.</EmptyState>
)
export const ProgressScreen = () => (
  <EmptyState title="No activity yet">Your heatmap fills as you log completed sessions.</EmptyState>
)
