import { useState } from 'react'
import { db, formatMoney, today, type Category } from '../db'
import type { ParsedItem } from '../parser'

interface Props {
  items: ParsedItem[]
  categories: Category[]
  onDone: () => void
}

export default function ConfirmCard({ items: initialItems, categories, onDone }: Props) {
  const [items, setItems] = useState(initialItems)

  const expenseCats = categories.filter((c) => c.type === 'expense')
  const incomeCats = categories.filter((c) => c.type === 'income')

  function update(index: number, patch: Partial<ParsedItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  function changeCategory(index: number, name: string) {
    const cat = categories.find((c) => c.name === name)
    if (cat) update(index, { category: cat.name, type: cat.type })
  }

  const valid = items.length > 0 && items.every((it) => it.amount > 0)

  async function saveAll() {
    if (!valid) return
    const now = Date.now()
    await db.transaction('rw', db.transactions, db.learned, async () => {
      await db.transactions.bulkAdd(
        items.map((it, i) => ({ ...it, note: it.note.trim(), createdAt: now + i })),
      )
      // 記住這次的分類，下次同品項直接套用
      const learned = items.filter((it) => it.note.trim()).map((it) => ({ note: it.note.trim(), category: it.category }))
      await db.learned.bulkPut(learned)
    })
    onDone()
  }

  const total = items.reduce((s, it) => s + (it.type === 'income' ? it.amount : -it.amount), 0)

  return (
    <div className="confirm-card">
      <div className="confirm-head">
        <strong>確認 {items.length} 筆</strong>
        <span>{total > 0 ? '+' : ''}{formatMoney(total)}</span>
      </div>

      {items.map((it, i) => (
        <div key={i} className="confirm-item">
          <div className="row">
            <input
              className="note"
              value={it.note}
              placeholder="品項"
              onChange={(e) => update(i, { note: e.target.value })}
            />
            <input
              className={'amount ' + it.type}
              type="number"
              inputMode="numeric"
              value={it.amount || ''}
              onChange={(e) => update(i, { amount: Math.round(Number(e.target.value)) || 0 })}
            />
            <button className="remove" aria-label="刪除這筆" onClick={() => setItems(items.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
          <div className="row">
            <select value={it.category} onChange={(e) => changeCategory(i, e.target.value)}>
              <optgroup label="支出">
                {expenseCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </optgroup>
              <optgroup label="收入">
                {incomeCats.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </optgroup>
            </select>
            <input type="date" value={it.date} onChange={(e) => update(i, { date: e.target.value || today() })} />
          </div>
        </div>
      ))}

      <div className="confirm-actions">
        <button onClick={onDone}>取消</button>
        <button className="strong" onClick={saveAll} disabled={!valid}>全部存入</button>
      </div>
    </div>
  )
}
