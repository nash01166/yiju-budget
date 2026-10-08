import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, monthRange, type Transaction } from '../db'
import TxList from '../components/TxList'
import MonthSwitch from '../components/MonthSwitch'

export interface ListFilter {
  month: string
  /** 分類名稱，空字串為全部 */
  category: string
}

interface Props {
  filter: ListFilter
  onFilterChange: (f: ListFilter) => void
  onSelect: (tx: Transaction) => void
}

export default function ListPage({ filter, onFilterChange, onSelect }: Props) {
  const { month, category } = filter
  const [query, setQuery] = useState('')
  const [from, to] = monthRange(month)

  const txs = useLiveQuery(async () => {
    const rows = await db.transactions.where('date').between(from, to, true, true).toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [from, to])
  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())

  const q = query.trim().toLowerCase()
  const shown = (txs ?? []).filter(
    (t) =>
      (!category || t.category === category) &&
      (!q || t.note.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)),
  )
  const income = shown.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = shown.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="page">
      <MonthSwitch month={month} onChange={(m) => onFilterChange({ ...filter, month: m })} />

      <div className="filters">
        <select value={category} onChange={(e) => onFilterChange({ ...filter, category: e.target.value })}>
          <option value="">全部分類</option>
          {(['expense', 'income'] as const).map((type) =>
            categories
              ?.filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.name}>
                  {type === 'expense' ? '支出' : '收入'} · {c.name}
                </option>
              )),
          )}
        </select>
        <input type="search" placeholder="搜尋備註" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <p className="subtotal">
        {shown.length} 筆 · 收入 <span className="income">{formatMoney(income)}</span> · 支出 {formatMoney(expense)}
      </p>

      {shown.length === 0 ? (
        <p className="empty">{txs?.length ? '沒有符合的紀錄' : '這個月還沒有紀錄'}</p>
      ) : (
        <TxList items={shown} onSelect={onSelect} />
      )}
    </div>
  )
}
