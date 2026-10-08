import { useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Category, type TxType } from '../db'
import { daysSinceBackup, exportBackup, exportCsv, restoreBackup } from '../backup'
import CategoryEditor from '../components/CategoryEditor'

export default function SettingsPage() {
  const [type, setType] = useState<TxType>('expense')
  /** null：關閉；{}：新增；有 id：編輯 */
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [message, setMessage] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const categories = useLiveQuery(() => db.categories.where('type').equals(type).sortBy('order'), [type])
  const backupDays = useLiveQuery(() => daysSinceBackup())
  const txCount = useLiveQuery(() => db.transactions.count())

  async function move(index: number, delta: number) {
    if (!categories) return
    const a = categories[index]
    const b = categories[index + delta]
    if (!a || !b) return
    await db.transaction('rw', db.categories, async () => {
      await db.categories.update(a.id!, { order: b.order })
      await db.categories.update(b.id!, { order: a.order })
    })
  }

  async function run(action: () => Promise<boolean>, done: string) {
    try {
      if (await action()) setMessage(done)
    } catch (e) {
      setMessage('失敗：' + (e as Error).message)
    }
  }

  async function onRestoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('還原會用備份檔「覆蓋」目前所有的帳目和分類，確定嗎？')) return
    try {
      const n = await restoreBackup(file)
      setMessage(`已還原 ${n} 筆帳目`)
    } catch (err) {
      setMessage('還原失敗：' + (err as Error).message)
    }
  }

  const backupText =
    backupDays == null ? '還沒有備份過' : backupDays === 0 ? '今天已備份' : `上次備份：${backupDays} 天前`

  return (
    <div className="page settings">
      <h2>分類</h2>
      <div className="segmented">
        <button className={type === 'expense' ? 'on' : ''} onClick={() => setType('expense')}>支出</button>
        <button className={type === 'income' ? 'on' : ''} onClick={() => setType('income')}>收入</button>
      </div>

      <ul className="cat-list">
        {categories?.map((c, i) => (
          <li key={c.id}>
            <button className="cat-main" onClick={() => setEditing(c)}>
              <span>{c.name}</span>
              {c.keywords && c.keywords.length > 0 && <small>{c.keywords.join('、')}</small>}
            </button>
            <button aria-label="往上移" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
            <button aria-label="往下移" disabled={i === categories.length - 1} onClick={() => move(i, 1)}>▼</button>
          </li>
        ))}
      </ul>
      <button className="primary" onClick={() => setEditing({})}>＋ 新增{type === 'expense' ? '支出' : '收入'}分類</button>
      <p className="muted small">點分類可以改名、設定關鍵字或刪除。報表顏色依這裡的順序，前 8 個各有顏色。</p>

      <h2>資料</h2>
      <p className="muted small">共 {txCount ?? 0} 筆帳目・{backupText}</p>
      <div className="action-list">
        <button onClick={() => run(exportBackup, '備份完成')}>💾 備份（存到「檔案」或 iCloud）</button>
        <button onClick={() => fileInput.current?.click()}>📂 從備份檔還原</button>
        <button onClick={() => run(exportCsv, 'CSV 已匯出')}>📄 匯出 CSV（可用 Excel 開啟）</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={onRestoreFile} />
      {message && <p className="notice">{message}</p>}

      <p className="muted small">
        資料只存在這支手機的這個 App 裡。換手機或清除 Safari 資料前，請先備份。
      </p>

      {editing && (
        <CategoryEditor
          initial={editing.id ? (editing as Category) : undefined}
          type={type}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
