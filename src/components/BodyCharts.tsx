import TrendChart from './charts'
import { Card, EmptyState } from './ui'
import { useData } from '../data/DataContext'
import { inTo, kgTo } from '../lib/units'

/** Weight and waist over time, each with its goal line. Two charts — never a dual axis. */
export default function BodyCharts() {
  const { bodyLogs, settings } = useData()
  const weight = bodyLogs.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, value: kgTo(b.weightKg!, settings.weightUnit) }))
  const waist = bodyLogs.filter((b) => b.waistIn != null).map((b) => ({ date: b.date, value: inTo(b.waistIn!, settings.lengthUnit) }))
  const goalW = settings.goalWeightKg != null ? kgTo(settings.goalWeightKg, settings.weightUnit) : null
  const goalWaist = settings.goalWaistIn != null ? inTo(settings.goalWaistIn, settings.lengthUnit) : null

  if (weight.length + waist.length === 0)
    return (
      <EmptyState icon="scale" title="No measurements yet">
        Log your weight and waist on the Body tab to see trends here.
      </EmptyState>
    )

  return (
    <div className="space-y-3">
      {weight.length > 0 && (
        <Card>
          <h3 className="mb-1 font-semibold">Body weight ({settings.weightUnit})</h3>
          {weight.length < 2 ? <p className="text-sm text-ink-500">Log one more weigh-in to see a trend.</p> : <TrendChart data={weight} unit={settings.weightUnit} goal={goalW} />}
        </Card>
      )}
      {waist.length > 0 && (
        <Card>
          <h3 className="mb-1 font-semibold">Waist ({settings.lengthUnit})</h3>
          {waist.length < 2 ? <p className="text-sm text-ink-500">Log one more measurement to see a trend.</p> : <TrendChart data={waist} unit={settings.lengthUnit} goal={goalWaist} />}
        </Card>
      )}
    </div>
  )
}
