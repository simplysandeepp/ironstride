import { getLocalDateKey } from '../../domain/dates.ts'
import { ProfileForm } from './ProfileForm.tsx'
import { defaultProfileValues } from './profileValues.ts'
import { saveProfileValues, skipOnboarding } from './saveProfile.ts'

export function OnboardingScreen() {
  return (
    <div className="app-shell">
      <header className="page-header">
        <h1>Welcome to IronStride</h1>
      </header>
      <main className="page-body">
        <p className="helper">
          These starting values are editable defaults. Everything is stored on this device only.
        </p>
        <ProfileForm
          initial={defaultProfileValues(getLocalDateKey())}
          submitLabel="Start training"
          onSubmit={saveProfileValues}
          secondary={{ label: 'Skip for now', onClick: () => void skipOnboarding() }}
        />
      </main>
    </div>
  )
}
