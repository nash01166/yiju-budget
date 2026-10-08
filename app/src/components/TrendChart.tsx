import { formatMoney } from '../db'

export interface MonthPoint {
  /** YYYY-MM */
  month: string
  income: number
  expense: number
}

interface Props {
  points: MonthPoint[]
  budget: number
  selected: string
  onSelect: (month: string) => void
}

const W = 340
const H = 170
const PAD = { top: 12, right: 8, bottom: 22, left: 8 }

/**
 * 近 12 個月收支折線圖。兩線之間：收入高於支出填綠色（存到錢），反之填紅色；
 * 交叉點切開分段上色。預算畫成虛線。
 */
export default function TrendChart({ points, budget, selected, onSelect }: Props) {
  const max = Math.max(1, budget, ...points.flatMap((p) => [p.income, p.expense])) * 1.1
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const step = plotW / (points.length - 1)
  const x = (i: number) => PAD.left + i * step
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH

  const line = (key: 'income' | 'expense') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')

  // 每一段在兩線之間填色，跨過交叉點就拆成兩塊
  const fills: { d: string; good: boolean }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const d0 = a.income - a.expense
    const d1 = b.income - b.expense
    const quad = (x0: number, x1: number, i0: number, e0: number, i1: number, e1: number) =>
      `M${x0},${y(i0)} L${x1},${y(i1)} L${x1},${y(e1)} L${x0},${y(e0)} Z`
    if (d0 * d1 < 0) {
      const t = d0 / (d0 - d1)
      const xm = x(i) + t * step
      const vm = a.income + t * (b.income - a.income)
      fills.push({ d: quad(x(i), xm, a.income, a.expense, vm, vm), good: d0 > 0 })
      fills.push({ d: quad(xm, x(i + 1), vm, vm, b.income, b.expense), good: d1 > 0 })
    } else {
      fills.push({ d: quad(x(i), x(i + 1), a.income, a.expense, b.income, b.expense), good: d0 + d1 >= 0 })
    }
  }

  const selIndex = points.findIndex((p) => p.month === selected)
  const sel = points[selIndex]

  return (
    <div className="trend">
      <div className="trend-legend">
        <span><i className="sw income" />收入</span>
        <span><i className="sw expense" />支出</span>
        {budget > 0 && <span><i className="sw budget" />預算</span>}
      </div>
      {sel && (
        <p className="trend-readout">
          {Number(sel.month.slice(5))} 月 · 收入 {formatMoney(sel.income)} · 支出 {formatMoney(sel.expense)}
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="近 12 個月收支折線圖">
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} className="axis" />
        {fills.map((f, i) => (
          <path key={i} d={f.d} className={f.good ? 'fill-good' : 'fill-bad'} />
        ))}
        {budget > 0 && <line x1={PAD.left} x2={W - PAD.right} y1={y(budget)} y2={y(budget)} className="budget-line" />}
        {selIndex >= 0 && <line x1={x(selIndex)} x2={x(selIndex)} y1={PAD.top} y2={y(0)} className="guide" />}
        <path d={line('income')} className="line-income" />
        <path d={line('expense')} className="line-expense" />
        {sel && (
          <>
            <circle cx={x(selIndex)} cy={y(sel.income)} r="4" className="dot-income" />
            <circle cx={x(selIndex)} cy={y(sel.expense)} r="4" className="dot-expense" />
          </>
        )}
        {points.map((p, i) => (
          <g key={p.month} onClick={() => onSelect(p.month)} className="hit">
            <rect x={x(i) - step / 2} y={0} width={step} height={H} fill="transparent" />
            <text x={x(i)} y={H - 6} textAnchor="middle" className={p.month === selected ? 'on' : ''}>
              {Number(p.month.slice(5))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
