import { RAMP_THRESHOLDS, type LoadRamp } from '../domain/insights/runInsights.ts'

const ZONES = [
  { id: 'lighter', label: 'Lighter', from: 0, to: RAMP_THRESHOLDS.lighter },
  { id: 'steady', label: 'Steady', from: RAMP_THRESHOLDS.lighter, to: RAMP_THRESHOLDS.building },
  { id: 'building', label: 'Building', from: RAMP_THRESHOLDS.building, to: RAMP_THRESHOLDS.spike },
  { id: 'spike', label: 'Spike', from: RAMP_THRESHOLDS.spike, to: 2 },
] as const

const MAX = 2

/** The last 7 days against your recent weekly average, on a scale from "lighter" to "spike". */
export function LoadGauge({ ramp }: { ramp: LoadRamp }) {
  const zone = ZONES.find((z) => z.id === ramp.zone)
  const position = ramp.ratio === null ? null : Math.min(MAX, Math.max(0, ramp.ratio)) / MAX
  const summary =
    ramp.ratio === null
      ? 'Not enough running history yet for a load reading.'
      : `${ramp.acuteKm} km in the last 7 days against an average week of ${ramp.chronicKm} km: ${ramp.ratio}x, ${zone?.label.toLowerCase()}.`

  return (
    <div className="gauge">
      <div className="gauge-track" role="img" aria-label={summary}>
        {ZONES.map((z) => (
          <span
            key={z.id}
            className="gauge-zone"
            data-zone={z.id}
            style={{ flexGrow: z.to - z.from }}
          />
        ))}
        {position !== null && (
          <span className="gauge-marker" style={{ left: `${position * 100}%` }} />
        )}
      </div>
      <div className="gauge-labels" aria-hidden="true">
        {ZONES.map((z) => (
          <span key={z.id} style={{ flexGrow: z.to - z.from }}>
            {z.label}
          </span>
        ))}
      </div>
      <p className="helper">{summary}</p>
    </div>
  )
}
