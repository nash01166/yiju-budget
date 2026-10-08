import { useState } from 'react'
import type { Transaction } from './db'
import HomePage from './pages/HomePage'
import ListPage from './pages/ListPage'
import ReportPage from './pages/ReportPage'
import SettingsPage from './pages/SettingsPage'
import TxForm from './components/TxForm'

type Tab = 'home' | 'list' | 'report' | 'settings'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: '記帳', icon: '✏️' },
  { key: 'list', label: '明細', icon: '📋' },
  { key: 'report', label: '報表', icon: '📊' },
  { key: 'settings', label: '設定', icon: '⚙️' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  /** null：表單關閉；{}：新增；有 id：編輯 */
  const [editing, setEditing] = useState<Partial<Transaction> | null>(null)

  const openNew = () => setEditing({})
  const openEdit = (tx: Transaction) => setEditing(tx)

  return (
    <div className="app">
      <main>
        {tab === 'home' && <HomePage onAdd={openNew} onSelect={openEdit} />}
        {tab === 'list' && <ListPage onSelect={openEdit} />}
        {tab === 'report' && <ReportPage />}
        {tab === 'settings' && <SettingsPage />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
            <span className="icon" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {editing && (
        <TxForm initial={editing.id ? (editing as Transaction) : undefined} onClose={() => setEditing(null)} />
      )}
    </div>
  )
}
