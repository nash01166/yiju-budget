import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, monthOf, monthRange, today, type TxType } from '../db'
import MonthSwitch from '../components/MonthSwitch'

/** 分類依「設定」中的順序取得固定色，前 8 個各有顏色，其餘併成灰色 */
const SLOT_COUNT = 8
const REST = 'rest'

interface Row {
  name: string
  amount: number
  /** 1..8 或 'rest' */
  slot: number | typeof REST
}

interface Slice {
  key: string
  label: string
  amount: number
  slot: number | typeof REST
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

const slotColor = (slot: number | typeof REST) => `var(--series-${slot})`

export default function ReportPage() {
  const [month, setMonth] = useState(monthOf(today()))
  const [type, setType] = useState<TxType>('expense')
  const [selected, setSelected] = useState<string | null>(null)
  const [from, to] = monthRange(month)

  const data = useLiveQuery(async () => {
    const [txs, cats] = await Promise.all([
      db.transactions.where('date').between(from, to, true, true).toArray(),
      db.categories.where('type').equals(type).sortBy('order'),
    ])
    const totals = { income: 0, expense: 0 }
    const byCat = new Map<string, number>()
    for (const t of txs) {
      totals[t.type] += t.amount
      if (t.type === type) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
    }
    const slotOf = new Map(cats.map((c, i) => [c.name, i < SLOT_COUNT ? i + 1 : REST] as const))
    const rows: Row[] = [...byCat]
      .map(([name, amount]) => ({ name, amount, slot: slotOf.get(name) ?? REST }))
      .sort((a, b) => b.amount - a.amount)
    return { totals, rows }
  }, [from, to, type])

  const rows = data?.rows ?? []
  const total = rows.reduce((s, r) => s + r.amount, 0)

  // 圓餅圖：有固定色的分類各一塊，灰色的併成一塊「其他分類」
  const slices: Slice[] = rows.filter((r) => r.slot !== REST).map((r) => ({ key: r.name, label: r.name, ...r }))
  const restRows = rows.filter((r) => r.slot === REST)
  if (restRows.length > 0) {
    const label = restRows.length === 1 ? restRows[0].name : `其他 ${restRows.length} 類`
    slices.push({ key: REST, label, amount: restRows.reduce((s, r) => s + r.amount, 0), slot: REST })
  }

  let angle = 0
  const arcs = slices.map((s) => {
    const start = angle
    angle += (s.amount / total) * Math.PI * 2
    return { ...s, d: arcPath(start, angle) }
  })

  const focus = selected ? slices.find((s) => s.key === selected) ?? null : null
  const sliceKeyOf = (r: Row) => (r.slot === REST ? REST : r.name)
  const toggle = (key: string) => setSelected(selected === key ? null : key)

  function switchType(t: TxType) {
    setType(t)
    setSelected(null)
  }

  return (
    <div className="page report">
      <MonthSwitch month={month} onChange={(m) => { setMonth(m); setSelected(null) }} />

      <div className="totals">
        <div><span>收入</span><strong className="income">{formatMoney(data?.totals.income ?? 0)}</strong></div>
        <div><span>支出</span><strong className="expense">{formatMoney(data?.totals.expense ?? 0)}</strong></div>
        <div>
          <span>結餘</span>
          <strong>{formatMoney((data?.totals.income ?? 0) - (data?.totals.expense ?? 0))}</strong>
        </div>
      </div>

      <div className="segmented">
        <button className={type === 'expense' ? 'on' : ''} onClick={() => switchType('expense')}>支出分類</button>
        <button className={type === 'income' ? 'on' : ''} onClick={() => switchType('income')}>收入分類</button>
      </div>

      {total === 0 ? (
        <p className="empty">這個月還沒有{type === 'expense' ? '支出' : '收入'}</p>
      ) : (
        <>
          <div className="donut-wrap">
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="donut" role="img" aria-label="分類占比圓餅圖">
              {arcs.map((a) => (
                <path
                  key={a.key}
                  d={a.d}
                  fill={slotColor(a.slot)}
                  opacity={focus && focus.key !== a.key ? 0.3 : 1}
                  onClick={() => toggle(a.key)}
                />
              ))}
            </svg>
            <div className="donut-center">
              <span>{focus ? focus.label : type === 'expense' ? '總支出' : '總收入'}</span>
              <strong>{formatMoney(focus ? focus.amount : total)}</strong>
              {focus && <span>{Math.round((focus.amount / total) * 100)}%</span>}
            </div>
          </div>

          <ul className="breakdown">
            {rows.map((r) => {
              const pct = (r.amount / total) * 100
              const key = sliceKeyOf(r)
              return (
                <li
                  key={r.name}
                  className={focus && focus.key !== key ? 'dim' : ''}
                  onClick={() => toggle(key)}
                >
                  <span className="dot" style={{ background: slotColor(r.slot) }} />
                  <span className="name">{r.name}</span>
                  <span className="pct">{pct < 1 ? '<1' : Math.round(pct)}%</span>
                  <span className="amt">{formatMoney(r.amount)}</span>
                  <span className="bar"><span style={{ width: `${pct}%`, background: slotColor(r.slot) }} /></span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
