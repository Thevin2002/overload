import { Segmented, Toggle } from './ui'
import type { HabitLog } from '../types'

export function HabitControls({ log, onChange }: { log: Partial<HabitLog>; onChange: (patch: Partial<HabitLog>) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 text-sm text-ink-600 dark:text-ink-300">Meals eaten</div>
        <Segmented value={log.meals ?? null} onChange={(meals) => onChange({ meals })} options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
      </div>
      <div>
        <div className="mb-1.5 text-sm text-ink-600 dark:text-ink-300">Meals with protein</div>
        <Segmented
          value={log.proteinMeals ?? null}
          onChange={(proteinMeals) => onChange({ proteinMeals })}
          options={[0, 1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
        />
      </div>
      <div>
        <div className="mb-1.5 text-sm text-ink-600 dark:text-ink-300">Energy</div>
        <Segmented
          value={log.energy ?? null}
          onChange={(energy) => onChange({ energy })}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: ['😴', '😕', '🙂', '😊', '⚡'][n - 1] + ' ' + n }))}
        />
      </div>
      <Toggle checked={!!log.workoutDone} onChange={(workoutDone) => onChange({ workoutDone })} label="Workout done" hint="Ticked automatically when you finish a workout" />
    </div>
  )
}
