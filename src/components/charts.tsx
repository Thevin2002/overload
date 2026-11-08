import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../lib/dates'

export interface TrendPoint {
  date: string
  value: number
}

/**
 * Single-series trend line (one axis, no legend — the card title names it).
 * Optional dashed goal line, labelled directly so it never relies on color.
 */
export default function TrendChart({
  data,
  unit,
  goal,
  height = 220,
  digits = 1,
}: {
  data: TrendPoint[]
  unit: string
  goal?: number | null
  height?: number
  digits?: number
}) {
  const values = data.map((d) => d.value)
  if (goal != null) values.push(goal)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.15, max * 0.02, 1)
  const fmt = (v: number) => String(Math.round(v * 10 ** digits) / 10 ** digits)

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => formatDate(d)}
            tick={{ fill: 'var(--chart-text)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fill: 'var(--chart-text)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={(v: number) => fmt(v)}
          />
          {goal != null && (
            <ReferenceLine
              y={goal}
              stroke="var(--goal)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: `Goal ${fmt(goal)}`, position: 'insideTopRight', fill: 'var(--chart-text)', fontSize: 11 }}
            />
          )}
          <Tooltip
            cursor={{ stroke: 'var(--chart-text)', strokeWidth: 1 }}
            contentStyle={{
              background: 'var(--chart-surface)',
              border: '1px solid var(--chart-grid)',
              borderRadius: 12,
              fontSize: 13,
            }}
            labelStyle={{ color: 'var(--chart-text)' }}
            itemStyle={{ color: 'inherit' }}
            labelFormatter={(d: string) => formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' })}
            formatter={(v: number) => [`${fmt(v)} ${unit}`, '']}
            separator=""
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={data.length <= 40 ? { r: 4, strokeWidth: 2, stroke: 'var(--chart-surface)', fill: 'var(--series-1)' } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--chart-surface)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
