import { shiftMonth } from '../db'

interface Props {
  /** YYYY-MM */
  month: string
  onChange: (month: string) => void
}

export default function MonthSwitch({ month, onChange }: Props) {
  const [y, m] = month.split('-').map(Number)
  return (
    <div className="month-switch">
      <button aria-label="上個月" onClick={() => onChange(shiftMonth(month, -1))}>‹</button>
      <strong>{y} 年 {m} 月</strong>
      <button aria-label="下個月" onClick={() => onChange(shiftMonth(month, 1))}>›</button>
    </div>
  )
}
