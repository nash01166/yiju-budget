import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, getBudget, monthOf, monthRange, shiftMonth, today } from '../db'
import MonthSwitch from '../components/MonthSwitch'
import CatIcon from '../components/CatIcon'
import TrendChart, { type MonthPoint } from '../components/TrendChart'

interface Props {
  /** 點分類橫條：跳到明細並篩選 */
  onOpenCategory: (month: string, category: string) => void
}

const SIZE = 200
const R_OUTER = 96
const R_INNER = 64
/** 扇形之間留 2px 縫 */
const GAP = 2

function polar(r: number, angle: number): [number, number] {
  return [SIZE / 2 + r * Math.sin(angle), SIZE / 2 - r * Math.cos(angle)]
}

function arcPath(start: number, end: number): string {
  // 只有一個扇形時畫完整的環
  if (end - start >= Math.PI * 2 - 1e-6) {
    const mid = start + Math.PI
    return arcPath(start, mid) + ' ' + arcPath(mid, end)
  }
  const gapOuter = GAP / 2 / R_OUTER
  const gapInner = GAP / 2 / R_INNER
  const [x1, y1] = polar(R_OUTER, start + gapOuter)
  const [x2, y2] = polar(R_OUTER, end - gapOuter)
  const [x3, y3] = polar(R_INNER, end - gapInner)
  const [x4, y4] = polar(R_INNER, start + gapInner)
  const large = end - start > Math.PI ? 1 : 0
  return `M${x1},${y1} A${R_OUTER},${R_OUTER} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_INNER},${R_INNER} 0 ${large} 0 ${x4},${y4} Z`
}

function sumByCategory(txs: { type: string; category: string; amount: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const t of txs) if (t.type === 'expense') m.set(t.category, (m.get(t.category) ?? 0) + t.amount)
  return m
}

export default function StatsPage({ onOpenCategory }: Props) {
  const current = monthOf(today())
  const [month, setMonth] = useState(current)
  const [focus, setFocus] = useState<string | null>(null)

  const data = useLiveQuery(async () => {
    const first = shiftMonth(current, -11)
    const [txs, cats, budget] = await Promise.all([
      db.transactions.where('date').between(`${first}-01`, `${current}-31`, true, true).toArray(),
      db.categories.where('type').equals('expense').sortBy('order'),
      getBudget(),
    ])
    // 選到 12 個月以前的月份時另外讀
    const [from, to] = monthRange(month)
    const [pFrom, pTo] = monthRange(shiftMonth(month, -1))
    const monthTxs = month >= first ? txs.filter((t) => t.date >= from && t.date <= to)
      : await db.transactions.where('date').between(from, to, true, true).toArray()
    const prevTxs = await db.transactions.where('date').between(pFrom, pTo, true, true).toArray()

    const points: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
      const m = shiftMonth(first, i)
      const inMonth = txs.filter((t) => monthOf(t.date) === m)
      return {
        month: m,
        income: inMonth.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: inMonth.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      }
    })
    return { cats, budget, monthTxs, byCat: sumByCategory(monthTxs), prevByCat: sumByCategory(prevTxs), points }
  }, [month, current])

  const byCat = data?.byCat ?? new Map<string, number>()
  const income = data?.monthTxs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
  const expense = [...byCat.values()].reduce((s, v) => s + v, 0)
  const colorOf = (name: string) => data?.cats.find((c) => c.name === name)?.color ?? '#8C7A6B'

  const rows = [...byCat].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  const catBudgets = data?.budget.categories ?? {}
  const scale = Math.max(1, ...rows.map((r) => Math.max(r.amount, catBudgets[r.name] ?? 0)))

  let angle = 0
  const arcs = rows.map((r) => {
    const start = angle
    angle += (r.amount / expense) * Math.PI * 2
    return { ...r, d: arcPath(start, angle) }
  })
  const focused = focus ? rows.find((r) => r.name === focus) : undefined

  const points = data?.points ?? []
  const totalIncome = points.reduce((s, p) => s + p.income, 0)
  const totalExpense = points.reduce((s, p) => s + p.expense, 0)
  const activeMonths = points.filter((p) => p.income || p.expense).length

  function changeMonth(m: string) {
    setMonth(m)
    setFocus(null)
  }

  const m = Number(month.slice(5))

  return (
    <div className="page stats">
      <MonthSwitch month={month} onChange={changeMonth} />

      <div className="card">
        <div className="card-head"><strong>支出分類</strong></div>
        {expense === 0 ? (
          <p className="empty">這個月還沒有支出</p>
        ) : (
          <>
            <div className="donut-wrap">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut" role="img" aria-label="支出分類占比圖">
                {arcs.map((a) => (
                  <path
                    key={a.name}
                    d={a.d}
                    fill={colorOf(a.name)}
                    opacity={focused && focused.name !== a.name ? 0.3 : 1}
                    onClick={() => setFocus(focus === a.name ? null : a.name)}
                  />
                ))}
              </svg>
              <div className="donut-center">
                <span>{focused ? focused.name : `${m} 月支出`}</span>
                <strong>{formatMoney(focused ? focused.amount : expense)}</strong>
                {focused && <span>{Math.round((focused.amount / expense) * 100)}%</span>}
              </div>
            </div>

            <ul className="cat-bars">
              {rows.map((r) => {
                const limit = catBudgets[r.name] ?? 0
                const over = limit > 0 && r.amount > limit
                const diff = r.amount - (data?.prevByCat.get(r.name) ?? 0)
                const pct = Math.round((r.amount / expense) * 100)
                return (
                  <li key={r.name} onClick={() => onOpenCategory(month, r.name)}>
                    <CatIcon name={r.name} color={colorOf(r.name)} size={32} />
                    <div className="bar-main">
                      <div className="bar-row">
                        <span className="name">{r.name}</span>
                        <span className="pct">{pct < 1 ? '<1' : pct}%</span>
                        <span className="amt">{formatMoney(r.amount)}</span>
                      </div>
                      <div className="bar-track">
                        <span
                          style={{ width: `${(r.amount / scale) * 100}%`, background: over ? 'var(--danger)' : colorOf(r.name) }}
                        />
                        {limit > 0 && <i className="budget-tick" style={{ left: `${(limit / scale) * 100}%` }} />}
                      </div>
                      <span className="delta">
                        {diff === 0 ? '與上月持平' : `比上月 ${diff > 0 ? '▲' : '▼'} ${formatMoney(Math.abs(diff))}`}
                        {over && ` · 超出預算 ${formatMoney(r.amount - limit)}`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <div className="totals">
        <div><span>收入</span><strong className="income">{formatMoney(income)}</strong></div>
        <div><span>支出</span><strong>{formatMoney(expense)}</strong></div>
        <div>
          <span>儲蓄率</span>
          <strong className={income - expense < 0 ? 'expense' : ''}>
            {income > 0 ? `${Math.round(((income - expense) / income) * 100)}%` : '—'}
          </strong>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><strong>近 12 個月收支</strong></div>
        <TrendChart points={points} budget={data?.budget.monthly ?? 0} selected={month} onSelect={changeMonth} />
        <div className="trend-summary">
          <div><span>12 個月收入</span><strong className="income">{formatMoney(totalIncome)}</strong></div>
          <div><span>12 個月支出</span><strong>{formatMoney(totalExpense)}</strong></div>
          <div>
            <span>平均每月支出</span>
            <strong>{formatMoney(activeMonths ? Math.round(totalExpense / activeMonths) : 0)}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
