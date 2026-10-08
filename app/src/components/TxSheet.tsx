import { useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, today, type Category, type Transaction, type TxType } from '../db'
import { useToast } from '../toast'
import CatIcon from './CatIcon'

interface Props {
  /** 有 id 為編輯，否則為新增 */
  initial?: Transaction
  onClose: () => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫']
const MAX_DIGITS = 9

/**
 * 三秒記帳：輸入金額 → 點分類就存好。
 * 編輯模式下點分類只是選取，按「儲存」才存。
 */
export default function TxSheet({ initial, onClose }: Props) {
  const editing = Boolean(initial?.id)
  const toast = useToast()
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense')
  const [digits, setDigits] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [note, setNote] = useState(initial?.note ?? '')
  const [shake, setShake] = useState(false)

  const categories = useLiveQuery(() => db.categories.where('type').equals(type).sortBy('order'), [type])
  const amount = Number(digits || '0')

  const press = useCallback((key: string) => {
    setDigits((d) => {
      if (key === '⌫') return d.slice(0, -1)
      const next = (d + key).replace(/^0+/, '')
      return next.length > MAX_DIGITS ? d : next
    })
  }, [])

  function nudge() {
    setShake(true)
    setTimeout(() => setShake(false), 400)
    toast('先輸入金額')
  }

  async function save(catName: string) {
    if (amount <= 0) return nudge()
    const data = { type, amount, category: catName, date, note: note.trim() }
    if (editing) {
      await db.transactions.update(initial!.id!, data)
      toast('已更新')
    } else {
      await db.transactions.add({ ...data, createdAt: Date.now() })
      toast(`已記下 ${catName} ${formatMoney(amount)}`)
    }
    if (data.note) await db.learned.put({ note: data.note, category: catName })
    onClose()
  }

  function pick(c: Category) {
    if (editing) setCategory(c.name)
    else save(c.name)
  }

  async function remove() {
    const tx = initial!
    await db.transactions.delete(tx.id!)
    onClose()
    toast('已刪除這筆紀錄', { label: '復原', run: () => db.transactions.add(tx) })
  }

  function switchType(t: TxType) {
    setType(t)
    setCategory('')
  }

  // 電腦上可以直接用鍵盤輸入
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('⌫')
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet tx-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-top">
          <div className="segmented small">
            <button className={type === 'expense' ? 'on' : ''} onClick={() => switchType('expense')}>支出</button>
            <button className={type === 'income' ? 'on' : ''} onClick={() => switchType('income')}>收入</button>
          </div>
          <button className="icon-btn" aria-label="關閉" onClick={onClose}>✕</button>
        </div>

        <div className={'amount-display' + (shake ? ' shake' : '') + (type === 'income' ? ' income' : '')}>
          <span>NT$</span>
          <strong>{amount.toLocaleString('zh-TW')}</strong>
        </div>

        <div className="sheet-row">
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value || today())}
            aria-label="日期"
          />
          <input
            type="text"
            placeholder="備註（選填）"
            maxLength={60}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="cat-grid">
          {categories?.map((c) => (
            <button key={c.id} className={c.name === category ? 'on' : ''} onClick={() => pick(c)}>
              <CatIcon name={c.name} color={c.color} size={40} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="keypad">
          {KEYS.map((k) => (
            <button key={k} onClick={() => press(k)} aria-label={k === '⌫' ? '刪除一位' : k}>
              {k}
            </button>
          ))}
        </div>

        {editing ? (
          <div className="sheet-actions">
            <button className="danger" onClick={remove}>刪除</button>
            <button className="strong" onClick={() => save(category)} disabled={!category}>儲存</button>
          </div>
        ) : (
          <p className="sheet-hint">輸入金額後點分類，就會自動存好</p>
        )}
      </div>
    </div>
  )
}
