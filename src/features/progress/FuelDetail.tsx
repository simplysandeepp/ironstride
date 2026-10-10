import { BarChart } from '../../components/BarChart.tsx'
import { HorizontalBars } from '../../components/HorizontalBars.tsx'
import { ProgressBar } from '../../components/ProgressBar.tsx'
import { StackedBar } from '../../components/StackedBar.tsx'
import { StatList, type Stat } from '../../components/StatList.tsx'
import { getDayOfWeek } from '../../domain/dates.ts'
import {
  estimateMaintenance,
  getIntakeSummary,
  getMacroSplit,
  getProteinByMeal,
  getSupplementAdherence,
  getWaistChange,
  getWaterSummary,
  getWeightProgress,
  targetForDate,
  targetMacroSplit,
} from '../../domain/insights/fuelInsights.ts'
import { mealLabel } from '../nutrition/foodForm.ts'
import type { DashboardData } from './useDashboardData.ts'

const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const dayLabel = (date: string) => `${WEEKDAY[getDayOfWeek(date)]} ${Number(date.slice(8))}`

/** The detailed fuel and body view: intake against targets, macros, consistency, weight and energy. */
export function FuelDetail({ data }: { data: DashboardData }) {
  const {
    foodEntries,
    nutritionTargets,
    today,
    profile,
    supplementLogs,
    waterEntries,
    waterTargetMl,
    bodyMeasurements,
  } = data
  const intake = getIntakeSummary(foodEntries, nutritionTargets, today)
  const target = targetForDate(nutritionTargets, today)
  const split = getMacroSplit(foodEntries, today)
  const meals = getProteinByMeal(foodEntries, today)
  const water = getWaterSummary(waterEntries, waterTargetMl, today)
  const trackingStart =
    [...supplementLogs.map((l) => l.date)].sort()[0] ?? profile.trainingStartDate
  const creatine = supplementLogs.some((l) => l.supplement === 'creatine')
    ? getSupplementAdherence(supplementLogs, 'creatine', today, trackingStart)
    : null
  const creatineTakenDays = new Set(
    supplementLogs
      .filter((l) => l.supplement === 'creatine' && l.status === 'taken')
      .map((l) => l.date),
  ).size
  const weight = getWeightProgress(bodyMeasurements, {
    minKg: profile.targetWeightMinKg,
    maxKg: profile.targetWeightMaxKg,
    startKg: profile.currentWeightKg,
  })
  const waist = getWaistChange(bodyMeasurements)
  const energy = estimateMaintenance(foodEntries, bodyMeasurements, today)
  const hasFood = intake.daysLogged > 0

  const consistency: Stat[] = [
    { label: 'Days with food logged', value: `${intake.daysLogged} of 7` },
    {
      label: 'Protein on target',
      value: hasFood ? `${intake.proteinHitDays} of ${intake.daysLogged} days` : '—',
      hint: '90% or more of target',
    },
    {
      label: 'Calories near target',
      value: hasFood ? `${intake.calorieOnTargetDays} of ${intake.daysLogged} days` : '—',
      hint: 'within 10%',
    },
    {
      label: 'Creatine',
      value: creatine
        ? `${creatine.taken} of ${creatine.windowDays} days`
        : creatineTakenDays > 0
          ? `${creatineTakenDays} day${creatineTakenDays === 1 ? '' : 's'} logged`
          : '—',
      hint: creatine
        ? undefined
        : creatineTakenDays > 0
          ? 'A percentage shows after 3 days'
          : 'Shows once you have logged it',
    },
    {
      label: 'Water goal',
      value: water.daysHit > 0 || waterEntries.length > 0 ? `${water.daysHit} of 7 days` : '—',
      hint: waterEntries.length ? `average ${water.avgMl} ml` : 'Shows once you log water',
    },
  ]

  return (
    <>
      <section className="card" aria-labelledby="kcal-heading">
        <h2 id="kcal-heading">Calories, last 7 days</h2>
        <BarChart
          tone="nutrition"
          title="Calories per day against target"
          unit="kcal"
          data={intake.days.map((d) => ({
            label: dayLabel(d.date),
            value: d.caloriesKcal,
            marker: d.targetKcal,
          }))}
          summary={
            hasFood
              ? `Bars are calories eaten; gold lines are your target. ${intake.daysLogged} of 7 days logged, averaging ${intake.avgKcal} kcal on those days.`
              : 'Log food and your daily calories appear here.'
          }
        />
      </section>

      <section className="card" aria-labelledby="protein-heading">
        <h2 id="protein-heading">Protein, last 7 days</h2>
        <BarChart
          tone="nutrition"
          title="Protein per day against target"
          unit="g"
          data={intake.days.map((d) => ({
            label: dayLabel(d.date),
            value: Math.round(d.proteinG),
            marker: d.targetProteinG,
          }))}
          summary={
            hasFood
              ? `Gold lines are your protein target (${target?.proteinG ?? '—'} g). ${intake.proteinHitDays} of ${intake.daysLogged} logged days reached 90% or more.`
              : 'Log food and your daily protein appears here.'
          }
        />
        {meals.length > 0 && (
          <>
            <h3>Where it comes from</h3>
            <HorizontalBars
              tone="nutrition"
              rows={meals
                .slice(0, 5)
                .map((m) => ({ label: mealLabel(m.meal), value: m.grams, unit: 'g' }))}
            />
          </>
        )}
      </section>

      <section className="card" aria-labelledby="macro-heading">
        <h2 id="macro-heading">Macro split</h2>
        {split ? (
          <>
            <StackedBar
              ariaLabel={`Last 7 days: ${split.proteinPct}% protein, ${split.carbsPct}% carbohydrate, ${split.fatPct}% fat, by energy.`}
              segments={[
                { label: 'Protein', value: split.proteinPct, tone: 'nutrition' },
                { label: 'Carbs', value: split.carbsPct, tone: 'gym' },
                { label: 'Fat', value: split.fatPct, tone: 'body' },
              ]}
            />
            {target && (
              <p className="helper">
                Your targets work out to {targetMacroSplit(target).proteinPct}% protein,{' '}
                {targetMacroSplit(target).carbsPct}% carbs and {targetMacroSplit(target).fatPct}%
                fat.
              </p>
            )}
          </>
        ) : (
          <p className="helper">Log food and the split of protein, carbs and fat appears here.</p>
        )}
      </section>

      <section className="card" aria-labelledby="consistency-heading">
        <h2 id="consistency-heading">Consistency</h2>
        <StatList stats={consistency} />
      </section>

      <section className="card" aria-labelledby="body-detail-heading">
        <h2 id="body-detail-heading">Body and energy</h2>
        {weight ? (
          <>
            {weight.progressPct !== null && (
              <>
                <ProgressBar
                  label="Progress toward your target range"
                  value={weight.progressPct}
                  max={100}
                  tone="body"
                />
                <p className="helper">
                  {weight.progressPct}% of the way from {profile.currentWeightKg} kg to{' '}
                  {profile.targetWeightMinKg} kg.
                </p>
              </>
            )}
            <StatList
              stats={[
                {
                  label: 'Average this week',
                  value: `${weight.latestAvgKg} kg`,
                  hint: weight.status,
                },
                {
                  label: 'Rate',
                  value:
                    weight.weeklyRateKg === null
                      ? '—'
                      : `${weight.weeklyRateKg > 0 ? '+' : ''}${weight.weeklyRateKg} kg a week`,
                  hint: weight.weeklyRateKg === null ? 'Needs 3 weeks of weights' : undefined,
                },
                {
                  label: 'Time to your range',
                  value: weight.etaWeeks ? `about ${weight.etaWeeks} weeks` : '—',
                  hint: weight.etaWeeks ? 'at the current rate' : undefined,
                },
                {
                  label: 'Waist',
                  value: waist ? `${waist.latestCm} cm` : '—',
                  hint: waist
                    ? `${waist.changeCm > 0 ? '+' : ''}${waist.changeCm} cm since ${waist.firstCm} cm`
                    : 'Log your waist twice to see change',
                },
              ]}
            />
          </>
        ) : (
          <p className="helper">
            Add a morning weight on the Nutrition screen and your trend and pace appear here.
          </p>
        )}
        <h3>Rough maintenance estimate</h3>
        {energy ? (
          <>
            <p>
              <strong className="metric-inline">{energy.maintenanceKcal} kcal</strong> a day
            </p>
            <p className="helper">
              You ate about {energy.avgIntakeKcal} kcal on {energy.loggedDays} logged days while
              your weekly weight moved {energy.weeklyRateKg > 0 ? '+' : ''}
              {energy.weeklyRateKg} kg. Water, salt and creatine shift the scale, so treat this as a
              guide, and use it only alongside how you feel and perform.
            </p>
          </>
        ) : (
          <p className="helper">
            Needs 10 days of food over 3 weeks and 3 weeks of weights, and then it appears here.
          </p>
        )}
        {weight && (
          <p className="helper">
            Weight gain is not all muscle: judge it over weeks alongside strength and waist.
          </p>
        )}
      </section>
    </>
  )
}
