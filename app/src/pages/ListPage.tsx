import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, monthOf, monthRange, today, type Transaction } from '../db'
import TxList from '../components/TxList'
import MonthSwitch from '../components/MonthSwitch'

interface Props {
  onSelect: (tx: Transaction) => void
}

export default function ListPage({ onSelect }: Props) {
  const [month, setMonth] = useState(monthOf(today()))
  const [from, to] = monthRange(month)

  const txs = useLiveQuery(async () => {
    const rows = await db.transactions.where('date').between(from, to, true, true).toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
  }, [from, to])

  const income = txs?.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) ?? 0
  const expense = txs?.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) ?? 0

  return (
    <div className="page">
      <MonthSwitch month={month} onChange={setMonth} />

      <div className="totals">
        <div><span>收入</span><strong className="income">{formatMoney(income)}</strong></div>
        <div><span>支出</span><strong className="expense">{formatMoney(expense)}</strong></div>
        <div><span>結餘</span><strong>{formatMoney(income - expense)}</strong></div>
      </div>

      <TxList items={txs ?? []} onSelect={onSelect} />
    </div>
  )
}
