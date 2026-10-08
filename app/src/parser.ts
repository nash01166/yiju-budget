import type { TxType } from './db'

export interface ParsedItem {
  note: string
  amount: number
  category: string
  type: TxType
  /** YYYY-MM-DD */
  date: string
}

export interface CategoryRef {
  name: string
  type: TxType
  keywords?: string[]
  builtin?: string
}

/** 內建關鍵字：品項含有關鍵字就歸到該分類，最長的關鍵字優先 */
const KEYWORDS: Record<string, string[]> = {
  餐飲: [
    '早餐', '午餐', '晚餐', '宵夜', '早午餐', '便當', '麵', '飯', '火鍋', '餐', '牛排', '披薩', '漢堡',
    '麥當勞', '肯德基', '摩斯', '拉麵', '壽司', '滷味', '鹹酥雞', '小吃', '水餃', '鍋貼', '粥', '自助餐',
    '小籠包', '吐司', '蛋餅', '飯糰', '燒肉', '丼', '咖哩', '義大利麵', '雞排', '外送', 'foodpanda', 'ubereats',
  ],
  飲料零食: [
    '飲料', '咖啡', '茶', '奶茶', '星巴克', '手搖', '珍奶', '果汁', '零食', '餅乾', '蛋糕', '甜點', '冰淇淋',
    '豆花', '啤酒', '酒', '可樂', '麵包', '拿鐵', '巧克力', '布丁',
  ],
  交通: [
    '捷運', '公車', '計程車', 'uber', '高鐵', '台鐵', '火車', '加油', '油錢', '停車', '機票', '客運',
    '悠遊卡', '儲值', 'ubike', 'youbike', '過路費', 'etag', '機車', '汽車', '保養', '洗車',
  ],
  購物: [
    '衣服', '褲', '鞋', '外套', '網購', '蝦皮', 'momo', '淘寶', '耳機', '電腦', '手機殼', '3c', '包包',
    '飾品', '化妝品', '保養品', 'uniqlo',
  ],
  日用品: [
    '衛生紙', '洗衣', '牙膏', '牙刷', '洗髮', '沐浴', '全聯', '家樂福', '好市多', '日用', '清潔', '垃圾袋',
    '電池', '雜貨',
  ],
  居住: ['房租', '租金', '水費', '電費', '瓦斯', '管理費', '房貸', '家具'],
  通訊網路: ['電話費', '手機費', '網路費', '網路', '電信', '月租', '中華電信', '台灣大哥大', '遠傳'],
  娛樂: [
    '電影', '遊戲', 'ktv', '唱歌', 'netflix', 'spotify', 'youtube', '演唱會', '門票', '旅遊', '住宿',
    '飯店', 'switch', 'steam', '健身', '展覽', '按摩',
  ],
  醫療: ['看醫生', '掛號', '診所', '醫院', '藥', '牙醫', '健保', '眼科', '看診', '維他命', '保健'],
  教育: ['書', '課程', '學費', '補習', '文具', '考試', '報名費'],
  人情社交: ['紅包', '禮物', '禮金', '請客', '喜酒', '白包', '奠儀', '送禮'],
  薪資: ['薪水', '薪資', '月薪', '工資', '打工', '時薪'],
  獎金: ['獎金', '年終', '分紅', '紅利', '績效'],
  投資: ['股利', '股息', '利息', '配息', '賣股', '獲利'],
  其他收入: ['退款', '退費', '中獎', '收入', '發票中獎', '回饋', '退稅'],
}

const RELATIVE_DAYS: [string, number][] = [
  ['大前天', -3],
  ['前天', -2],
  ['昨天', -1],
  ['昨日', -1],
  ['今天', 0],
  ['今日', 0],
]

/** 不屬於品項名稱的贅字 */
const FILLER = /^(買了|買|付了|付|吃了|吃|喝了|喝|花了|花)|(花了|花費|花|共|總共|大概|約)$/g

function addDays(base: string, delta: number): string {
  const [y, m, d] = base.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return [dt.getFullYear(), String(dt.getMonth() + 1).padStart(2, '0'), String(dt.getDate()).padStart(2, '0')].join('-')
}

/** 全形數字與符號轉半形，去掉千分位逗號 */
function normalize(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[／]/g, '/')
    .replace(/(\d),(\d{3})(?!\d)/g, '$1$2')
}

/** 從片段中取出日期詞，回傳日期與去掉日期詞後的文字 */
function extractDate(segment: string, today: string): { date: string | null; rest: string } {
  for (const [word, delta] of RELATIVE_DAYS) {
    if (segment.includes(word)) return { date: addDays(today, delta), rest: segment.replace(word, ' ') }
  }
  const md = segment.match(/(\d{1,2})\s*(?:\/|月)\s*(\d{1,2})\s*(?:日|號)?/)
  if (md) {
    const month = Number(md[1])
    const day = Number(md[2])
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let year = Number(today.slice(0, 4))
      // 輸入的月份比今天還晚，視為去年（例如一月輸入 12/30）
      if (`${year}-${md[1].padStart(2, '0')}-${md[2].padStart(2, '0')}` > today) year -= 1
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      return { date, rest: segment.replace(md[0], ' ') }
    }
  }
  return { date: null, rest: segment }
}

function cleanNote(raw: string): string {
  return raw.trim().replace(FILLER, '').trim()
}

export function guessCategory(
  note: string,
  categories: CategoryRef[],
  learned: Map<string, string>,
): CategoryRef {
  const valid = new Map(categories.map((c) => [c.name, c]))
  const fallback = valid.get('其他') ?? categories.find((c) => c.type === 'expense') ?? categories[0]

  const remembered = learned.get(note)
  if (remembered && valid.has(remembered)) return valid.get(remembered)!

  const lower = note.toLowerCase()
  let best: { cat: CategoryRef; len: number } | null = null
  for (const cat of categories) {
    // 內建關鍵字 + 自訂關鍵字 + 分類名稱本身
    const words = [...(KEYWORDS[cat.builtin ?? cat.name] ?? []), ...(cat.keywords ?? []), cat.name]
    for (const raw of words) {
      const w = raw.trim().toLowerCase()
      if (w && lower.includes(w) && (!best || w.length > best.len)) best = { cat, len: w.length }
    }
  }
  return best?.cat ?? fallback
}

/**
 * 把一句話拆成多筆帳目。
 * 例：「昨天午餐 150、飲料55元，捷運 30」→ 3 筆，日期都是昨天
 */
export function parseSentence(
  text: string,
  today: string,
  categories: CategoryRef[],
  learned: Map<string, string> = new Map(),
): ParsedItem[] {
  const items: ParsedItem[] = []
  let currentDate = today

  for (const rawSegment of normalize(text).split(/[、，,；;。\n]+/)) {
    const { date, rest } = extractDate(rawSegment, today)
    if (date) currentDate = date

    // 每個「文字 + 數字」配成一筆；同一片段可以有多筆，例如「早餐60 午餐120」
    const pairs = [...rest.matchAll(/([^\d]*?)\s*(\d+(?:\.\d+)?)\s*(?:塊錢|元整|元|塊|nt|NT)?/g)]
    if (pairs.length === 0) continue

    const lastPair = pairs[pairs.length - 1]
    const trailing = rest.slice(lastPair.index! + lastPair[0].length)

    pairs.forEach((m, i) => {
      let note = cleanNote(m[1])
      // 「150 午餐」這種數字在前的寫法：只有一筆時，用數字後面的文字當品項
      if (!note && pairs.length === 1 && i === 0) note = cleanNote(trailing)
      const amount = Math.round(Number(m[2]))
      if (!(amount > 0)) return
      const cat = guessCategory(note, categories, learned)
      items.push({ note, amount, category: cat.name, type: cat.type, date: currentDate })
    })
  }

  return items
}
