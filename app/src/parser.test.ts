import { describe, expect, it } from 'vitest'
import { parseSentence, type CategoryRef } from './parser'

const CATS: CategoryRef[] = [
  ...['餐飲', '飲料零食', '交通', '購物', '日用品', '居住', '通訊網路', '娛樂', '醫療', '教育', '人情社交', '訂閱', '其他'].map(
    (name) => ({ name, type: 'expense' as const }),
  ),
  ...['薪資', '獎金', '投資', '其他收入'].map((name) => ({ name, type: 'income' as const })),
]
const TODAY = '2026-10-09'
const parse = (text: string, learned?: Map<string, string>) => parseSentence(text, TODAY, CATS, learned)

describe('parseSentence', () => {
  it('拆出多筆並分類', () => {
    expect(parse('午餐 150、飲料 55、捷運 30')).toEqual([
      { note: '午餐', amount: 150, category: '餐飲', type: 'expense', date: TODAY },
      { note: '飲料', amount: 55, category: '飲料零食', type: 'expense', date: TODAY },
      { note: '捷運', amount: 30, category: '交通', type: 'expense', date: TODAY },
    ])
  })

  it('同一片段沒有分隔符也能拆', () => {
    expect(parse('早餐60 午餐120').map((i) => [i.note, i.amount])).toEqual([
      ['早餐', 60],
      ['午餐', 120],
    ])
  })

  it('金額單位、千分位、全形數字', () => {
    expect(parse('房租 12,000元').map((i) => [i.note, i.amount, i.category])).toEqual([['房租', 12000, '居住']])
    expect(parse('咖啡８５塊')[0].amount).toBe(85)
  })

  it('收入', () => {
    expect(parse('薪水 45000')[0]).toMatchObject({ type: 'income', category: '薪資' })
  })

  it('相對日期套用到後面的品項', () => {
    const items = parse('昨天晚餐 200，飲料 60')
    expect(items.map((i) => [i.note, i.date])).toEqual([
      ['晚餐', '2026-10-08'],
      ['飲料', '2026-10-08'],
    ])
  })

  it('月/日 日期，晚於今天視為去年', () => {
    expect(parse('10/5 加油 1200')[0]).toMatchObject({ note: '加油', date: '2026-10-05', category: '交通' })
    expect(parse('12月30日 電影 300')[0].date).toBe('2025-12-30')
  })

  it('最長關鍵字優先', () => {
    expect(parse('飯店 3000')[0].category).toBe('娛樂')
    expect(parse('麵包 45')[0].category).toBe('飲料零食')
  })

  it('去掉贅字', () => {
    expect(parse('買咖啡花了 120')[0].note).toBe('咖啡')
  })

  it('數字在前', () => {
    expect(parse('150 牛肉麵')[0]).toMatchObject({ note: '牛肉麵', amount: 150, category: '餐飲' })
  })

  it('訂閱服務', () => {
    expect(parse('Netflix 390、iCloud 90').map((i) => i.category)).toEqual(['訂閱', '訂閱'])
  })

  it('認不出來就歸其他', () => {
    expect(parse('阿明 500')[0].category).toBe('其他')
  })

  it('學習過的品項優先', () => {
    expect(parse('阿明 500', new Map([['阿明', '人情社交']]))[0].category).toBe('人情社交')
  })

  it('自訂分類：分類名稱與自訂關鍵字', () => {
    const cats: CategoryRef[] = [...CATS, { name: '寵物', type: 'expense', keywords: ['飼料', '獸醫'] }]
    expect(parseSentence('貓飼料 800、寵物美容 1200', TODAY, cats).map((i) => i.category)).toEqual(['寵物', '寵物'])
  })

  it('內建分類改名後仍沿用內建關鍵字', () => {
    const cats = CATS.map((c) => (c.name === '餐飲' ? { ...c, name: '吃飯', builtin: '餐飲' } : c))
    expect(parseSentence('午餐 100', TODAY, cats)[0].category).toBe('吃飯')
  })

  it('沒有金額就不產生帳目', () => {
    expect(parse('今天好累')).toEqual([])
  })
})
