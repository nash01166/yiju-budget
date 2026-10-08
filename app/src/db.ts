import Dexie, { type EntityTable } from 'dexie'

export type TxType = 'expense' | 'income'

export interface Transaction {
  id?: number
  type: TxType
  amount: number
  category: string
  /** YYYY-MM-DD，以本地時區為準 */
  date: string
  note: string
  createdAt: number
}

export interface Category {
  id?: number
  type: TxType
  name: string
  order: number
  /** 使用者自訂的關鍵字，一句話記帳時品項含有就歸到這個分類 */
  keywords?: string[]
  /** 內建分類的原始名稱；改名後仍沿用內建關鍵字 */
  builtin?: string
}

export interface Setting {
  key: string
  value: string
}

/** 一句話記帳學到的「品項 → 分類」 */
export interface Learned {
  note: string
  category: string
}

export const db = new Dexie('yiju-budget') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>
  categories: EntityTable<Category, 'id'>
  settings: EntityTable<Setting, 'key'>
  learned: EntityTable<Learned, 'note'>
}

db.version(1).stores({
  transactions: '++id, date, type, category',
  categories: '++id, type, order',
  settings: 'key',
})

db.version(2).stores({
  learned: 'note',
})

const DEFAULT_CATEGORIES: Record<TxType, string[]> = {
  expense: ['餐飲', '飲料零食', '交通', '購物', '日用品', '居住', '通訊網路', '娛樂', '醫療', '教育', '人情社交', '其他'],
  income: ['薪資', '獎金', '投資', '其他收入'],
}
const BUILTIN_NAMES = new Set([...DEFAULT_CATEGORIES.expense, ...DEFAULT_CATEGORIES.income])

// 第 3 步之前建立的內建分類補上 builtin，之後改名才不會失去內建關鍵字
db.version(3).stores({}).upgrade((tx) =>
  tx.table('categories').toCollection().modify((c: Category) => {
    if (BUILTIN_NAMES.has(c.name)) c.builtin = c.name
  }),
)

db.on('populate', (tx) => {
  const rows: Category[] = []
  for (const type of ['expense', 'income'] as const) {
    DEFAULT_CATEGORIES[type].forEach((name, order) => rows.push({ type, name, order, builtin: name }))
  }
  tx.table('categories').bulkAdd(rows)
})

export const LAST_BACKUP_KEY = 'lastBackupAt'

/** 本地時區的 YYYY-MM-DD */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return toDateString(new Date())
}

/** YYYY-MM */
export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  return toDateString(new Date(y, m - 1 + delta, 1)).slice(0, 7)
}

export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${month}-31`]
}

export function formatMoney(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('zh-TW')
}
