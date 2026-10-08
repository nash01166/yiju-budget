import { db, LAST_BACKUP_KEY, pickColor, today, type Category, type Learned, type Setting, type Transaction } from './db'

interface BackupFile {
  app: 'yiju-budget'
  version: 1
  exportedAt: string
  transactions: Transaction[]
  categories: Category[]
  learned: Learned[]
  /** 預算、自訂角色圖等設定；舊版備份沒有這個欄位 */
  settings?: Setting[]
}

/**
 * iPhone 上用分享選單存檔（可存到「檔案」App / iCloud 雲碟），其他環境直接下載。
 * 使用者取消分享時回傳 false。
 */
async function saveFile(name: string, content: string, mime: string): Promise<boolean> {
  const file = new File([content], name, { type: mime })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return true
    } catch (e) {
      if ((e as Error).name === 'AbortError') return false
      throw e
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

export async function exportBackup(): Promise<boolean> {
  const data: BackupFile = {
    app: 'yiju-budget',
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    categories: await db.categories.toArray(),
    learned: await db.learned.toArray(),
    settings: (await db.settings.toArray()).filter((s) => s.key !== LAST_BACKUP_KEY),
  }
  const ok = await saveFile(`一句記帳備份-${today()}.json`, JSON.stringify(data), 'application/json')
  if (ok) await db.settings.put({ key: LAST_BACKUP_KEY, value: String(Date.now()) })
  return ok
}

/** 用備份檔覆蓋目前所有資料，回傳還原的帳目筆數 */
export async function restoreBackup(file: File): Promise<number> {
  let data: BackupFile
  try {
    data = JSON.parse(await file.text())
  } catch {
    throw new Error('檔案不是有效的備份檔')
  }
  if (data.app !== 'yiju-budget' || !Array.isArray(data.transactions) || !Array.isArray(data.categories)) {
    throw new Error('這不是一句記帳的備份檔')
  }
  // 舊版備份的分類沒有顏色，補上
  const used: string[] = []
  const categories = data.categories.map((c) => {
    const color = c.color ?? pickColor(used)
    used.push(color)
    return { ...c, color }
  })
  await db.transaction('rw', [db.transactions, db.categories, db.learned, db.settings], async () => {
    await Promise.all([db.transactions.clear(), db.categories.clear(), db.learned.clear()])
    await db.transactions.bulkAdd(data.transactions)
    await db.categories.bulkAdd(categories)
    await db.learned.bulkAdd(data.learned ?? [])
    if (data.settings) {
      // 有設定才覆蓋；舊版備份保留目前的預算等設定
      const lastBackup = await db.settings.get(LAST_BACKUP_KEY)
      await db.settings.clear()
      await db.settings.bulkPut(data.settings.filter((s) => s.key !== LAST_BACKUP_KEY))
      if (lastBackup) await db.settings.put(lastBackup)
    }
  })
  return data.transactions.length
}

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function exportCsv(): Promise<boolean> {
  const txs = await db.transactions.orderBy('date').toArray()
  const rows = [
    ['日期', '類型', '分類', '金額', '備註'],
    ...txs.map((t) => [t.date, t.type === 'income' ? '收入' : '支出', t.category, t.amount, t.note]),
  ]
  // 加 BOM，Excel 打開中文才不會亂碼
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
  return saveFile(`一句記帳-${today()}.csv`, csv, 'text/csv')
}

/** 距離上次備份的天數；從沒備份過回傳 null */
export async function daysSinceBackup(): Promise<number | null> {
  const row = await db.settings.get(LAST_BACKUP_KEY)
  if (!row) return null
  return Math.floor((Date.now() - Number(row.value)) / 86_400_000)
}
