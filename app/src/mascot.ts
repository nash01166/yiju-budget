import { db } from './db'

/** 自訂角色圖只存在這支手機（IndexedDB），不會進公開的程式碼 */
export const MASCOT_KEY = 'mascot'

const MAX_SIDE = 256

/** 讀取使用者選的圖片，縮到 256px 以內並轉成 PNG（保留透明背景）後存起來 */
export async function setMascot(file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    await db.settings.put({ key: MASCOT_KEY, value: canvas.toDataURL('image/png') })
  } catch (e) {
    throw new Error((e as Error).message === '請選擇圖片檔' ? '請選擇圖片檔' : '這張圖片讀不出來，換一張試試')
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function clearMascot(): Promise<void> {
  await db.settings.delete(MASCOT_KEY)
}

export async function getMascot(): Promise<string | null> {
  return (await db.settings.get(MASCOT_KEY))?.value ?? null
}
