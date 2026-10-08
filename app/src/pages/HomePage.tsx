import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, monthOf, monthRange, today, type Transaction } from '../db'
import TxList from '../components/TxList'

interface Props {
  onAdd: () => void
  onSelect: (tx: Transaction) => void
}

export default function HomePage({ onAdd, onSelect }: Props) {
  const todayStr = today()
  const [from, to] = monthRange(monthOf(todayStr))

  const monthExpense = useLiveQuery(async () => {
    const txs = await db.transactions.where('date').between(from, to, true, true).toArray()
    return txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  }, [from, to])

  const todayTxs = useLiveQuery(
    () => db.transactions.where('date').equals(todayStr).reverse().sortBy('createdAt'),
    [todayStr],
  )

  return (
    <div className="page">
      <div className="summary-card">
        <span>本月支出</span>
        <strong>{formatMoney(monthExpense ?? 0)}</strong>
      </div>

      <div className="ai-box disabled">
        <input placeholder="AI 記帳（第 2 步開放）" disabled />
      </div>

      <button className="primary" onClick={onAdd}>＋ 手動記一筆</button>

      <h2>今天</h2>
      <TxList items={todayTxs ?? []} onSelect={onSelect} grouped={false} />
    </div>
  )
}
