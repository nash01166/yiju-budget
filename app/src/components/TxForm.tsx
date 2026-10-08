import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, today, type Transaction, type TxType } from '../db'

interface Props {
  /** 有 id 為編輯，否則為新增 */
  initial?: Transaction
  onClose: () => void
}

export default function TxForm({ initial, onClose }: Props) {
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [note, setNote] = useState(initial?.note ?? '')

  const categories = useLiveQuery(
    () => db.categories.where('type').equals(type).sortBy('order'),
    [type],
  )
  const selected = category || categories?.[0]?.name || ''

  const amountNum = Number(amount)
  const valid = amount !== '' && Number.isFinite(amountNum) && amountNum > 0 && selected !== ''

  async function save() {
    if (!valid) return
    const data = { type, amount: Math.round(amountNum), category: selected, date, note: note.trim() }
    if (initial?.id) {
      await db.transactions.update(initial.id, data)
    } else {
      await db.transactions.add({ ...data, createdAt: Date.now() })
    }
    onClose()
  }

  async function remove() {
    if (!initial?.id || !confirm('確定刪除這筆？')) return
    await db.transactions.delete(initial.id)
    onClose()
  }

  function switchType(t: TxType) {
    setType(t)
    setCategory('')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button className="link" onClick={onClose}>取消</button>
          <strong>{initial?.id ? '修改' : '記一筆'}</strong>
          <button className="link strong" onClick={save} disabled={!valid}>儲存</button>
        </div>

        <div className="segmented">
          <button className={type === 'expense' ? 'on' : ''} onClick={() => switchType('expense')}>支出</button>
          <button className={type === 'income' ? 'on' : ''} onClick={() => switchType('income')}>收入</button>
        </div>

        <label className="field">
          <span>金額</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus={!initial}
          />
        </label>

        <div className="field">
          <span>分類</span>
          <div className="chips">
            {categories?.map((c) => (
              <button
                key={c.id}
                className={'chip' + (c.name === selected ? ' on' : '')}
                onClick={() => setCategory(c.name)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>日期</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
        </label>

        <label className="field">
          <span>備註</span>
          <input type="text" placeholder="例如：牛肉麵" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        {initial?.id && (
          <button className="danger" onClick={remove}>刪除這筆</button>
        )}
      </div>
    </div>
  )
}
