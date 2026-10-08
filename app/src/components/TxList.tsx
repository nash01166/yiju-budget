import { formatMoney, type Transaction } from '../db'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}/${d}（${WEEKDAYS[new Date(y, m - 1, d).getDay()]}）`
}

interface Props {
  items: Transaction[]
  onSelect: (tx: Transaction) => void
  /** 是否依日期分組顯示標題 */
  grouped?: boolean
}

export default function TxList({ items, onSelect, grouped = true }: Props) {
  if (items.length === 0) return <p className="empty">還沒有帳目</p>

  const groups = new Map<string, Transaction[]>()
  for (const tx of items) {
    const key = grouped ? tx.date : ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  return (
    <div className="tx-list">
      {[...groups].map(([date, txs]) => {
        const net = txs.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
        return (
          <section key={date}>
            {grouped && (
              <h3 className="group-title">
                <span>{dateLabel(date)}</span>
                <span>{net > 0 ? '+' : ''}{formatMoney(net)}</span>
              </h3>
            )}
            <ul>
              {txs.map((tx) => (
                <li key={tx.id} onClick={() => onSelect(tx)}>
                  <span className="cat">{tx.category}</span>
                  <span className="note">{tx.note}</span>
                  <span className={'amt ' + tx.type}>
                    {tx.type === 'income' ? '+' : '-'}{formatMoney(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
