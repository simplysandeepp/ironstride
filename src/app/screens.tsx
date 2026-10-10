import { EmptyState } from '../components/EmptyState.tsx'

// Placeholder screens; each is replaced by its feature module in a later PR.
export const NutritionScreen = () => (
  <EmptyState title="No meals logged">Food, water and supplements will appear here.</EmptyState>
)
export const ProgressScreen = () => (
  <EmptyState title="No activity yet">Your heatmap fills as you log completed sessions.</EmptyState>
)
