import { useLiveQuery } from 'dexie-react-hooks'
import { getLocalDateKey } from '../../domain/dates.ts'
import { repositories } from '../../db/repositories.ts'
import { EmptyState } from '../../components/EmptyState.tsx'
import { InstallHelp } from './InstallHelp.tsx'
import { ProfileForm } from './ProfileForm.tsx'
import { defaultProfileValues, profileToValues } from './profileValues.ts'
import { saveProfileValues } from './saveProfile.ts'

export function SettingsScreen() {
  const data = useLiveQuery(async () => {
    const today = getLocalDateKey()
    return {
      profile: await repositories.profile.get(),
      targets: await repositories.nutritionTargets.forDate(today),
    }
  })

  if (!data) return <EmptyState title="Loading">Reading your settings.</EmptyState>

  const initial =
    data.profile && data.targets
      ? profileToValues(data.profile, data.targets)
      : defaultProfileValues(getLocalDateKey())

  return (
    <div className="stack">
      <p className="helper">
        Changing your weekly running or start date adjusts your plan. Past logs are never rewritten.
      </p>
      <ProfileForm
        key={JSON.stringify(initial)}
        initial={initial}
        submitLabel="Save changes"
        onSubmit={saveProfileValues}
      />
      <InstallHelp />
    </div>
  )
}
