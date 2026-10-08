import { useState } from 'react'
import { daysInMonth, formatMoney, setBudget, today, type BudgetSettings } from '../db'
import Pudding from './Pudding'

interface Props {
  budget: BudgetSettings
  /** 本月支出 */
  spent: number
}

/** 首頁的每月預算卡；還沒設定時直接在卡片上設定 */
export default function BudgetCard({ budget, spent }: Props) {
  const [input, setInput] = useState('')

  if (budget.monthly <= 0) {
    const value = Math.round(Number(input))
    return (
      <div className="card budget-card empty">
        <div className="budget-setup-text">
          <Pudding size={48} />
          <span>還沒設定每月預算</span>
        </div>
        <div className="budget-setup">
          <input
            type="number"
            inputMode="numeric"
            placeholder="例如 20000"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button disabled={!(value > 0)} onClick={() => setBudget({ ...budget, monthly: value })}>設定</button>
        </div>
      </div>
    )
  }

  const t = today()
  const month = Number(t.slice(5, 7))
  const daysLeft = daysInMonth(t.slice(0, 7)) - Number(t.slice(8, 10)) + 1
  const remaining = budget.monthly - spent
  const ratio = spent / budget.monthly
  const state = ratio > 1 ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'

  return (
    <div className={'card budget-card ' + state}>
      <div className="budget-head">
        <span>{month} 月預算 · 剩 {daysLeft} 天</span>
        <span className="pill">{state === 'over' ? '已超支' : `已用 ${Math.round(ratio * 100)}%`}</span>
      </div>
      <div className="budget-main">
        <div>
          <span className="muted">{remaining >= 0 ? '還可以花' : '超出預算'}</span>
          <strong className="big-num">{formatMoney(Math.abs(remaining))}</strong>
        </div>
        <Pudding size={64} mood={state === 'ok' ? 'happy' : 'worried'} />
      </div>
      <div className="progress"><span style={{ width: `${Math.min(ratio, 1) * 100}%` }} /></div>
      <div className="budget-foot">
        <span>已花 {formatMoney(spent)} / {formatMoney(budget.monthly)}</span>
        <span>平均每天可花 {formatMoney(Math.max(0, Math.floor(remaining / daysLeft)))}</span>
      </div>
    </div>
  )
}
