import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, monthOf, monthRange, today, type Transaction } from '../db'
import { parseSentence, type ParsedItem } from '../parser'
import TxList from '../components/TxList'
import ConfirmCard from '../components/ConfirmCard'

interface Props {
  onAdd: () => void
  onSelect: (tx: Transaction) => void
}

export default function HomePage({ onAdd, onSelect }: Props) {
  const todayStr = today()
  const [from, to] = monthRange(monthOf(todayStr))
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedItem[] | null>(null)
  const [hint, setHint] = useState('')

  const monthExpense = useLiveQuery(async () => {
    const txs = await db.transactions.where('date').between(from, to, true, true).toArray()
    return txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  }, [from, to])

  const todayTxs = useLiveQuery(
    () => db.transactions.where('date').equals(todayStr).reverse().sortBy('createdAt'),
    [todayStr],
  )

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim() || !categories) return
    const learned = new Map((await db.learned.toArray()).map((l) => [l.note, l.category]))
    const items = parseSentence(text, todayStr, categories, learned)
    if (items.length === 0) {
      setHint('看不出金額，請用「品項 金額」的格式，例如：午餐 150、飲料 55')
      return
    }
    setHint('')
    setParsed(items)
  }

  function finish() {
    setParsed(null)
    setText('')
  }

  return (
    <div className="page">
      <div className="summary-card">
        <span>本月支出</span>
        <strong>{formatMoney(monthExpense ?? 0)}</strong>
      </div>

      {parsed && categories ? (
        <ConfirmCard items={parsed} categories={categories} onDone={finish} />
      ) : (
        <form className="quick-box" onSubmit={submit}>
          <input
            placeholder="午餐 150、飲料 55、捷運 30"
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
          />
          <button type="submit" disabled={!text.trim()}>記帳</button>
        </form>
      )}
      {hint && <p className="hint">{hint}</p>}

      <button className="primary" onClick={onAdd}>＋ 手動記一筆</button>

      <h2>今天</h2>
      <TxList items={todayTxs ?? []} onSelect={onSelect} grouped={false} />
    </div>
  )
}
