import { useState, type ReactElement } from 'react'
import { monthOf, today, type Transaction } from './db'
import { ToastProvider } from './toast'
import HomePage from './pages/HomePage'
import ListPage, { type ListFilter } from './pages/ListPage'
import StatsPage from './pages/StatsPage'
import SettingsPage from './pages/SettingsPage'
import TxSheet from './components/TxSheet'
import Pudding from './components/Pudding'

type Tab = 'home' | 'list' | 'stats' | 'settings'

const TITLES: Record<Tab, string> = { home: '一句記帳', list: '明細', stats: '統計', settings: '設定' }

const ICONS: Record<Exclude<Tab, 'settings'>, ReactElement> = {
  home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
}

const NAV: { key: Exclude<Tab, 'settings'>; label: string }[] = [
  { key: 'home', label: '首頁' },
  { key: 'list', label: '明細' },
  { key: 'stats', label: '統計' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  /** null：關閉；'new'：新增；Transaction：編輯 */
  const [sheet, setSheet] = useState<Transaction | 'new' | null>(null)
  const [listFilter, setListFilter] = useState<ListFilter>({ month: monthOf(today()), category: '' })

  return (
    <ToastProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <Pudding size={34} />
            <h1>{TITLES[tab]}</h1>
          </div>
          {tab !== 'settings' && (
            <button className="icon-btn" aria-label="設定" onClick={() => setTab('settings')}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
              </svg>
            </button>
          )}
        </header>

        <main>
          {tab === 'home' && <HomePage onSelect={setSheet} onEditBudget={() => setTab('settings')} />}
          {tab === 'list' && <ListPage filter={listFilter} onFilterChange={setListFilter} onSelect={setSheet} />}
          {tab === 'stats' && (
            <StatsPage
              onOpenCategory={(month, category) => {
                setListFilter({ month, category })
                setTab('list')
              }}
            />
          )}
          {tab === 'settings' && <SettingsPage onBack={() => setTab('home')} />}
        </main>

        {tab !== 'settings' && (
          <button className="fab" aria-label="記一筆" onClick={() => setSheet('new')}>＋</button>
        )}

        <nav className="tabbar">
          {NAV.map((t) => (
            <button key={t.key} className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[t.key]}
              </svg>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {sheet && <TxSheet initial={sheet === 'new' ? undefined : sheet} onClose={() => setSheet(null)} />}
      </div>
    </ToastProvider>
  )
}
