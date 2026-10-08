import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORY_PALETTE, db, pickColor, renameBudgetCategory, type Category, type TxType } from '../db'
import CatIcon from './CatIcon'

interface Props {
  /** 有 id 為編輯，否則為新增 */
  initial?: Category
  type: TxType
  onClose: () => void
}

function parseKeywords(text: string): string[] {
  return [...new Set(text.split(/[、，,\s]+/).map((w) => w.trim()).filter(Boolean))]
}

export default function CategoryEditor({ initial, type, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join('、'))
  const [moveTo, setMoveTo] = useState('')
  const [error, setError] = useState('')
  const [chosenColor, setChosenColor] = useState(initial?.color ?? '')

  const all = useLiveQuery(() => db.categories.toArray())
  const siblings = all?.filter((c) => c.type === type && c.id !== initial?.id) ?? []
  const color = chosenColor || pickColor(siblings.map((c) => c.color))
  // 刪除時帳目預設移到「其他」／「其他收入」
  const defaultTarget =
    siblings.find((c) => c.name === '其他' || c.name === '其他收入')?.name ?? siblings[0]?.name ?? ''
  const usage = useLiveQuery(
    () => (initial ? db.transactions.where('category').equals(initial.name).count() : 0),
    [initial?.name],
  )

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return setError('請輸入分類名稱')
    if (all?.some((c) => c.name === trimmed && c.id !== initial?.id)) return setError('已經有同名的分類')
    const kw = parseKeywords(keywords)

    if (!initial?.id) {
      // 新分類插在「其他」前面
      const same = (all ?? []).filter((c) => c.type === type).sort((a, b) => a.order - b.order)
      const other = same.find((c) => c.name === '其他' || c.name === '其他收入')
      const order = other ? other.order : (same[same.length - 1]?.order ?? -1) + 1
      await db.transaction('rw', db.categories, async () => {
        for (const c of same) if (c.order >= order) await db.categories.update(c.id!, { order: c.order + 1 })
        await db.categories.add({ type, name: trimmed, order, keywords: kw, color })
      })
      return onClose()
    }

    const oldName = initial.name
    await db.transaction('rw', db.categories, db.transactions, db.learned, async () => {
      await db.categories.update(initial.id!, { name: trimmed, keywords: kw, color })
      if (oldName !== trimmed) {
        // 改名時，已記的帳目與學過的品項一起改
        await db.transactions.where('category').equals(oldName).modify({ category: trimmed })
        await db.learned.filter((l) => l.category === oldName).modify({ category: trimmed })
      }
    })
    if (oldName !== trimmed) await renameBudgetCategory(oldName, trimmed)
    onClose()
  }

  async function remove() {
    if (!initial?.id) return
    if (siblings.length === 0) return setError('至少要保留一個分類')
    const target = moveTo || defaultTarget
    const message = usage
      ? `「${initial.name}」有 ${usage} 筆帳目，會移到「${target}」。確定刪除？`
      : `確定刪除「${initial.name}」？`
    if (!confirm(message)) return
    await db.transaction('rw', db.categories, db.transactions, db.learned, async () => {
      await db.transactions.where('category').equals(initial.name).modify({ category: target })
      await db.learned.filter((l) => l.category === initial.name).modify({ category: target })
      await db.categories.delete(initial.id!)
    })
    await renameBudgetCategory(initial.name, null)
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <button className="link" onClick={onClose}>取消</button>
          <strong>{initial?.id ? '編輯分類' : `新增${type === 'expense' ? '支出' : '收入'}分類`}</strong>
          <button className="link strong" onClick={save}>儲存</button>
        </div>

        <label className="field">
          <span>名稱</span>
          <div className="name-row">
            <CatIcon name={name || '?'} color={color} />
            <input
              value={name}
              maxLength={8}
              placeholder="例如 寵物"
              onChange={(e) => { setName(e.target.value); setError('') }}
              autoFocus={!initial}
            />
          </div>
        </label>

        <div className="field">
          <span>顏色</span>
          <div className="swatches">
            {CATEGORY_PALETTE.map((c) => (
              <button
                key={c}
                className={c === color ? 'on' : ''}
                style={{ background: c }}
                aria-label={`顏色 ${c}`}
                onClick={() => setChosenColor(c)}
              />
            ))}
          </div>
        </div>

        <label className="field">
          <span>關鍵字（用頓號或空白隔開）</span>
          <input
            placeholder="例如：飼料、獸醫、貓砂"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <small className="muted">一句話記帳時，品項含有這些字就會自動歸到這個分類。分類名稱本身也算關鍵字。</small>
        </label>

        {error && <p className="hint">{error}</p>}

        {initial?.id && (
          <div className="field">
            <span>刪除分類</span>
            {usage ? (
              <label className="inline">
                這個分類有 {usage} 筆帳目，刪除後移到
                <select value={moveTo || defaultTarget} onChange={(e) => setMoveTo(e.target.value)}>
                  {siblings.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </label>
            ) : null}
            <button className="danger" onClick={remove}>刪除「{initial.name}」</button>
          </div>
        )}
      </div>
    </div>
  )
}
