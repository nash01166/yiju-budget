interface Props {
  name: string
  color?: string
  size?: number
}

/** 分類圖示：彩色圓點 + 分類名稱第一個字 */
export default function CatIcon({ name, color = '#8C7A6B', size = 36 }: Props) {
  return (
    <span
      className="cat-icon"
      aria-hidden="true"
      style={{ background: color, width: size, height: size, fontSize: size * 0.44 }}
    >
      {[...name][0]}
    </span>
  )
}
