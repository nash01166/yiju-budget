import { useLiveQuery } from 'dexie-react-hooks'
import { db, dayLabel, formatMoney, type Transaction } from '../db'
import CatIcon from './CatIcon'

interface Props {
  items: Transaction[]
  onSelect: (tx: Transaction) => void
}

/** 依日期分組的帳目列表，日標題右邊是當日支出 */
export default function TxList({ items, onSelect }: Props) {
  const colors = useLiveQuery(async () => new Map((await db.categories.toArray()).map((c) => [c.name, c.color])))

  const groups = new Map<string, Transaction[]>()
  for (const tx of items) {
    if (!groups.has(tx.date)) groups.set(tx.date, [])
    groups.get(tx.date)!.push(tx)
  }

  return (
    <div className="tx-list">
      {[...groups].map(([date, txs]) => {
        const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        return (
          <section key={date}>
            <h3 className="group-title">
              <span>{dayLabel(date)}</span>
              {spent > 0 && <span>支出 {formatMoney(spent)}</span>}
            </h3>
            <ul>
              {txs.map((tx) => (
                <li key={tx.id} onClick={() => onSelect(tx)}>
                  <CatIcon name={tx.category} color={colors?.get(tx.category)} />
                  <div className="tx-main">
                    <span className="cat">{tx.category}</span>
                    {tx.note && <span className="note">{tx.note}</span>}
                  </div>
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
