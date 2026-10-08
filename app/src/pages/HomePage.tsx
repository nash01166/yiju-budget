import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, formatMoney, getBudget, monthOf, monthRange, today, type Transaction } from '../db'
import { parseSentence, type ParsedItem } from '../parser'
import { daysSinceBackup, exportBackup } from '../backup'
import TxList from '../components/TxList'
import ConfirmCard from '../components/ConfirmCard'
import BudgetCard from '../components/BudgetCard'
import CatIcon from '../components/CatIcon'
import Pudding from '../components/Pudding'

interface Props {
  onSelect: (tx: Transaction) => void
  onEditBudget: () => void
}

export default function HomePage({ onSelect, onEditBudget }: Props) {
  const todayStr = today()
  const [from, to] = monthRange(monthOf(todayStr))
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState<ParsedItem[] | null>(null)
  const [hint, setHint] = useState('')

  const month = useLiveQuery(async () => {
    const txs = await db.transactions.where('date').between(from, to, true, true).toArray()
    const byCat = new Map<string, number>()
    let income = 0
    let expense = 0
    for (const t of txs) {
      if (t.type === 'income') income += t.amount
      else {
        expense += t.amount
        byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
      }
    }
    return { income, expense, byCat }
  }, [from, to])

  const recent = useLiveQuery(async () => {
    const rows = await db.transactions.orderBy('date').reverse().limit(40).toArray()
    return rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 10)
  })

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray())
  const budget = useLiveQuery(() => getBudget(), [], null)

  // 有帳目且超過 7 天沒備份（或從沒備份過）就提醒
  const backupDue = useLiveQuery(async () => {
    if ((await db.transactions.count()) === 0) return null
    const days = await daysSinceBackup()
    if (days === null) return '還沒有備份過資料'
    return days >= 7 ? `已經 ${days} 天沒備份了` : null
  })
  const [backupError, setBackupError] = useState('')

  async function backupNow() {
    try {
      await exportBackup()
      setBackupError('')
    } catch (e) {
      setBackupError('備份失敗：' + (e as Error).message)
    }
  }

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

  const income = month?.income ?? 0
  const expense = month?.expense ?? 0
  const catBudgets = budget ? Object.entries(budget.categories).filter(([, v]) => v > 0) : []
  const colorOf = (name: string) => categories?.find((c) => c.name === name)?.color

  return (
    <div className="page">
      {budget && <BudgetCard budget={budget} spent={expense} />}

      <div className="totals">
        <div><span>本月收入</span><strong className="income">{formatMoney(income)}</strong></div>
        <div><span>本月支出</span><strong>{formatMoney(expense)}</strong></div>
        <div><span>結餘</span><strong className={income - expense < 0 ? 'expense' : ''}>{formatMoney(income - expense)}</strong></div>
      </div>

      {budget && catBudgets.length > 0 && (
        <div className="card">
          <div className="card-head">
            <strong>分類預算</strong>
            <button className="link" onClick={onEditBudget}>編輯</button>
          </div>
          <ul className="cat-budgets">
            {catBudgets.map(([name, limit]) => {
              const spent = month?.byCat.get(name) ?? 0
              const ratio = spent / limit
              const state = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
              return (
                <li key={name} className={state}>
                  <CatIcon name={name} color={colorOf(name)} size={28} />
                  <div className="cb-main">
                    <div className="cb-row">
                      <span>{name}</span>
                      <span className="num">{formatMoney(spent)} / {formatMoney(limit)}</span>
                    </div>
                    <div className="progress thin"><span style={{ width: `${Math.min(ratio, 1) * 100}%` }} /></div>
                  </div>
                </li>
              )
            })}
            <li className="cb-other">
              <span>其他未設預算</span>
              <span className="num">
                {formatMoney(
                  [...(month?.byCat ?? [])].filter(([n]) => !(budget.categories[n] > 0)).reduce((s, [, v]) => s + v, 0),
                )}
              </span>
            </li>
          </ul>
        </div>
      )}

      {backupDue && (
        <div className="backup-banner">
          <span>⚠️ {backupDue}</span>
          <button onClick={backupNow}>立即備份</button>
        </div>
      )}
      {backupError && <p className="hint">{backupError}</p>}

      {parsed && categories ? (
        <ConfirmCard items={parsed} categories={categories} onDone={finish} />
      ) : (
        <form className="quick-box" onSubmit={submit}>
          <input
            placeholder="一句話記帳：午餐 150、飲料 55"
            value={text}
            onChange={(e) => setText(e.target.value)}
            enterKeyHint="send"
          />
          <button type="submit" disabled={!text.trim()}>記帳</button>
        </form>
      )}
      {hint && <p className="hint">{hint}</p>}

      <h2>最近紀錄</h2>
      {recent && recent.length === 0 ? (
        <div className="empty-state">
          <Pudding size={96} />
          <strong>還沒有任何紀錄</strong>
          <span>按右下角的 ＋，輸入金額、點分類，就記好了。</span>
        </div>
      ) : (
        <TxList items={recent ?? []} onSelect={onSelect} />
      )}
    </div>
  )
}
