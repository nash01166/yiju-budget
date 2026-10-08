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
  /** 圖示與圖表用的顏色 */
  color?: string
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
  expense: ['餐飲', '飲料零食', '交通', '購物', '日用品', '居住', '通訊網路', '娛樂', '醫療', '教育', '人情社交', '訂閱', '其他'],
  income: ['薪資', '獎金', '投資', '其他收入'],
}
const BUILTIN_NAMES = new Set([...DEFAULT_CATEGORIES.expense, ...DEFAULT_CATEGORIES.income])

/** 分類色盤（沿用三秒記帳的配色），新增分類時挑還沒用過的 */
export const CATEGORY_PALETTE = [
  '#E07A5F', '#3D7DD8', '#C25FAD', '#D49A12', '#7B61D1', '#2A9D8F',
  '#D2555A', '#7F9A2C', '#5C8DA8', '#B5651D', '#1D7F55', '#8C7A6B',
  '#D9822B', '#D46A9C', '#4F9E3A', '#5E6AD2',
]

const DEFAULT_COLORS: Record<string, string> = {
  餐飲: '#E07A5F', 飲料零食: '#B5651D', 交通: '#3D7DD8', 購物: '#C25FAD', 日用品: '#7F9A2C',
  居住: '#D49A12', 通訊網路: '#5C8DA8', 娛樂: '#7B61D1', 醫療: '#2A9D8F', 教育: '#D2555A',
  人情社交: '#1D7F55', 訂閱: '#3D7DD8', 其他: '#8C7A6B',
  薪資: '#1D7F55', 獎金: '#2A9D8F', 投資: '#3D7DD8', 其他收入: '#8C7A6B',
}

export function pickColor(used: (string | undefined)[]): string {
  return CATEGORY_PALETTE.find((c) => !used.includes(c)) ?? CATEGORY_PALETTE[used.length % CATEGORY_PALETTE.length]
}

// 第 3 步之前建立的內建分類補上 builtin，之後改名才不會失去內建關鍵字
db.version(3).stores({}).upgrade((tx) =>
  tx.table('categories').toCollection().modify((c: Category) => {
    if (BUILTIN_NAMES.has(c.name)) c.builtin = c.name
  }),
)

// 比照三秒記帳：分類加上顏色，並新增「訂閱」分類（放在「其他」前面）
db.version(4).stores({}).upgrade(async (tx) => {
  const table = tx.table<Category, number>('categories')
  const cats = await table.toArray()
  const used: string[] = []
  for (const c of cats) {
    const color = DEFAULT_COLORS[c.builtin ?? c.name] ?? pickColor(used)
    used.push(color)
    await table.update(c.id!, { color })
  }
  if (!cats.some((c) => c.name === '訂閱')) {
    const expense = cats.filter((c) => c.type === 'expense').sort((a, b) => a.order - b.order)
    const other = expense.find((c) => c.name === '其他')
    const order = other ? other.order : (expense[expense.length - 1]?.order ?? -1) + 1
    for (const c of expense) if (c.order >= order) await table.update(c.id!, { order: c.order + 1 })
    await table.add({ type: 'expense', name: '訂閱', order, builtin: '訂閱', color: DEFAULT_COLORS['訂閱'] })
  }
})

db.on('populate', (tx) => {
  const rows: Category[] = []
  for (const type of ['expense', 'income'] as const) {
    DEFAULT_CATEGORIES[type].forEach((name, order) =>
      rows.push({ type, name, order, builtin: name, color: DEFAULT_COLORS[name] }),
    )
  }
  tx.table('categories').bulkAdd(rows)
})

export const LAST_BACKUP_KEY = 'lastBackupAt'
export const BUDGET_KEY = 'budget'

export interface BudgetSettings {
  /** 每月總預算，0 表示未設定 */
  monthly: number
  /** 分類名稱 → 每月預算 */
  categories: Record<string, number>
}

export async function getBudget(): Promise<BudgetSettings> {
  const row = await db.settings.get(BUDGET_KEY)
  return row ? JSON.parse(row.value) : { monthly: 0, categories: {} }
}

export async function setBudget(b: BudgetSettings): Promise<void> {
  await db.settings.put({ key: BUDGET_KEY, value: JSON.stringify(b) })
}

/** 分類改名或刪除時，同步搬移分類預算 */
export async function renameBudgetCategory(oldName: string, newName: string | null): Promise<void> {
  const b = await getBudget()
  if (!(oldName in b.categories)) return
  const amount = b.categories[oldName]
  delete b.categories[oldName]
  if (newName && !(newName in b.categories)) b.categories[newName] = amount
  await setBudget(b)
}

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

/** 某月的天數 */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 「今天 · 10 月 9 日 週四」 */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  const t = today()
  const yesterday = toDateString(new Date(Date.now() - 86_400_000))
  const prefix = date === t ? '今天 · ' : date === yesterday ? '昨天 · ' : ''
  return `${prefix}${m} 月 ${d} 日 週${wd}`
}

export function formatMoney(n: number): string {
  return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('zh-TW')
}
