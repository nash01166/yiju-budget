import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, getBudget, setBudget, type BudgetSettings, type Category, type TxType } from '../db'
import { daysSinceBackup, exportBackup, exportCsv, restoreBackup } from '../backup'
import { applyTheme, getThemePref, type ThemePref } from '../theme'
import { useToast } from '../toast'
import { clearMascot, getMascot, setMascot } from '../mascot'
import CategoryEditor from '../components/CategoryEditor'
import CatIcon from '../components/CatIcon'
import Pudding from '../components/Pudding'

interface Props {
  onBack: () => void
}

const toNumber = (s: string) => Math.max(0, Math.round(Number(s) || 0))

export default function SettingsPage({ onBack }: Props) {
  const toast = useToast()
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  /** null：關閉；{ type }：新增；有 id：編輯 */
  const [editing, setEditing] = useState<(Partial<Category> & { type: TxType }) | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const mascotInput = useRef<HTMLInputElement>(null)
  const hasMascot = useLiveQuery(async () => (await getMascot()) !== null)

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())
  const savedBudget = useLiveQuery(() => getBudget())
  const backupDays = useLiveQuery(() => daysSinceBackup())
  const txCount = useLiveQuery(() => db.transactions.count())

  // 預算欄位先放本地，離開欄位才存，打字時不會被即時更新蓋掉
  const [draft, setDraft] = useState<{ monthly: string; categories: Record<string, string> } | null>(null)
  useEffect(() => {
    if (savedBudget && !draft) {
      setDraft({
        monthly: savedBudget.monthly ? String(savedBudget.monthly) : '',
        categories: Object.fromEntries(Object.entries(savedBudget.categories).map(([k, v]) => [k, String(v)])),
      })
    }
  }, [savedBudget, draft])

  function draftToBudget(d: NonNullable<typeof draft>): BudgetSettings {
    const cats: Record<string, number> = {}
    for (const [k, v] of Object.entries(d.categories)) if (toNumber(v) > 0) cats[k] = toNumber(v)
    return { monthly: toNumber(d.monthly), categories: cats }
  }

  const commitBudget = () => draft && setBudget(draftToBudget(draft))

  const expenseCats = categories?.filter((c) => c.type === 'expense') ?? []
  const incomeCats = categories?.filter((c) => c.type === 'income') ?? []
  const budget = draft ? draftToBudget(draft) : null
  const allocated = budget ? Object.values(budget.categories).reduce((s, v) => s + v, 0) : 0

  async function move(list: Category[], index: number, delta: number) {
    const a = list[index]
    const b = list[index + delta]
    if (!a || !b) return
    await db.transaction('rw', db.categories, async () => {
      await db.categories.update(a.id!, { order: b.order })
      await db.categories.update(b.id!, { order: a.order })
    })
  }

  function changeTheme(t: ThemePref) {
    setTheme(t)
    applyTheme(t)
  }

  async function run(action: () => Promise<boolean>, done: string) {
    try {
      if (await action()) toast(done)
    } catch (e) {
      toast('失敗：' + (e as Error).message)
    }
  }

  async function onMascotFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await setMascot(file)
      toast('已換上新的角色圖')
    } catch (err) {
      toast((err as Error).message)
    }
  }

  async function onRestoreFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('還原會用備份檔「覆蓋」目前所有的帳目和分類，確定嗎？')) return
    try {
      const n = await restoreBackup(file)
      setDraft(null)
      toast(`已還原 ${n} 筆帳目`)
    } catch (err) {
      toast('還原失敗：' + (err as Error).message)
    }
  }

  const backupText =
    backupDays == null ? '還沒有備份過' : backupDays === 0 ? '今天已備份' : `上次備份：${backupDays} 天前`

  const catList = (list: Category[]) => (
    <ul className="cat-list">
      {list.map((c, i) => (
        <li key={c.id}>
          <button className="cat-main" onClick={() => setEditing(c)}>
            <CatIcon name={c.name} color={c.color} size={30} />
            <div>
              <span>{c.name}</span>
              {c.keywords && c.keywords.length > 0 && <small>{c.keywords.join('、')}</small>}
            </div>
          </button>
          <button aria-label="往上移" disabled={i === 0} onClick={() => move(list, i, -1)}>▲</button>
          <button aria-label="往下移" disabled={i === list.length - 1} onClick={() => move(list, i, 1)}>▼</button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="page settings">
      <h2>預算</h2>
      {draft && budget && (
        <div className="card">
          <label className="budget-input">
            <span>每月總預算</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="例如 20000"
              value={draft.monthly}
              onChange={(e) => setDraft({ ...draft, monthly: e.target.value })}
              onBlur={commitBudget}
            />
          </label>
          <p className="muted small">每月 1 號重新計算，沒花完的不會累積到下個月。</p>

          <div className="card-head"><strong>分類預算</strong><span className="muted small">留空表示不限</span></div>
          <ul className="budget-list">
            {expenseCats.map((c) => (
              <li key={c.id}>
                <CatIcon name={c.name} color={c.color} size={28} />
                <span>{c.name}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="不限"
                  value={draft.categories[c.name] ?? ''}
                  onChange={(e) => setDraft({ ...draft, categories: { ...draft.categories, [c.name]: e.target.value } })}
                  onBlur={commitBudget}
                />
              </li>
            ))}
          </ul>
          {budget.monthly > 0 && (
            <p className={'small ' + (allocated > budget.monthly ? 'expense' : 'muted')}>
              已分配 {formatMoney(allocated)} · {allocated > budget.monthly
                ? `超過總預算 ${formatMoney(allocated - budget.monthly)}`
                : `未分配 ${formatMoney(budget.monthly - allocated)}`}
            </p>
          )}
        </div>
      )}

      <h2>外觀</h2>
      <div className="segmented three">
        {(['system', 'light', 'dark'] as const).map((t) => (
          <button key={t} className={theme === t ? 'on' : ''} onClick={() => changeTheme(t)}>
            {t === 'system' ? '跟隨系統' : t === 'light' ? '淺色' : '深色'}
          </button>
        ))}
      </div>
      <p className="muted small">只影響這台裝置。</p>

      <div className="card mascot-card">
        <Pudding size={64} />
        <div className="mascot-actions">
          <strong>角色圖</strong>
          <span className="muted small">換成你自己的圖片，只存在這支手機，不會上傳。</span>
          <div className="mascot-buttons">
            <button className="link" onClick={() => mascotInput.current?.click()}>選擇圖片</button>
            {hasMascot && (
              <button className="link" onClick={() => clearMascot().then(() => toast('已恢復預設布丁'))}>
                恢復預設布丁
              </button>
            )}
          </div>
        </div>
      </div>
      <input ref={mascotInput} type="file" accept="image/*" hidden onChange={onMascotFile} />

      <h2>支出分類</h2>
      {catList(expenseCats)}
      <button className="primary" onClick={() => setEditing({ type: 'expense' })}>＋ 新增支出分類</button>

      <h2>收入分類</h2>
      {catList(incomeCats)}
      <button className="primary" onClick={() => setEditing({ type: 'income' })}>＋ 新增收入分類</button>
      <p className="muted small">點分類可以改名、換顏色、設定一句話記帳的關鍵字，或刪除。</p>

      <h2>備份</h2>
      <p className="muted small">共 {txCount ?? 0} 筆帳目 · {backupText}</p>
      <div className="action-list">
        <button onClick={() => run(exportBackup, '備份完成')}>💾 備份（存到「檔案」或 iCloud）</button>
        <button onClick={() => fileInput.current?.click()}>📂 從備份檔還原</button>
        <button onClick={() => run(exportCsv, 'CSV 已匯出')}>📄 匯出 CSV（可用 Excel 開啟）</button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={onRestoreFile} />
      <p className="muted small">資料只存在這支手機的這個 App 裡。換手機或清除 Safari 資料前，請先備份。</p>

      <button className="primary" onClick={onBack}>回到首頁</button>
      <p className="muted small version">版本 {__APP_VERSION__}</p>

      {editing && (
        <CategoryEditor
          initial={editing.id ? (editing as Category) : undefined}
          type={editing.type}
          onClose={() => {
            setEditing(null)
            setDraft(null) // 分類改名或刪除會搬移分類預算，重新讀取
          }}
        />
      )}
    </div>
  )
}
