import { useLiveQuery } from 'dexie-react-hooks'
import { getMascot } from '../mascot'

interface Props {
  size?: number
  mood?: 'happy' | 'worried'
}

/** 角色圖：有自訂圖片就用使用者的圖，否則用自繪的布丁（不使用任何角色版權圖） */
export default function Pudding({ size = 40, mood = 'happy' }: Props) {
  const mascot = useLiveQuery(() => getMascot())
  if (mascot) {
    return <img src={mascot} width={size} height={size} alt="" className="mascot" />
  }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="pudding">
      <ellipse cx="32" cy="56" rx="26" ry="5" fill="var(--plate)" />
      <path d="M14 52 L19 22 Q32 16 45 22 L50 52 Q32 58 14 52 Z" fill="var(--custard)" />
      <path
        d="M19 22 Q32 16 45 22 L46 28 Q43 32 40 29 Q37 34 33 30 Q29 35 26 30 Q22 33 18 28 Z"
        fill="var(--caramel)"
      />
      <circle cx="26" cy="40" r="2.2" fill="var(--ink)" />
      <circle cx="38" cy="40" r="2.2" fill="var(--ink)" />
      {mood === 'happy' ? (
        <path d="M28 45 Q32 49 36 45" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M28 48 Q32 44 36 48" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" />
      )}
      <ellipse cx="22" cy="45" rx="3" ry="1.8" fill="var(--blush)" opacity="0.7" />
      <ellipse cx="42" cy="45" rx="3" ry="1.8" fill="var(--blush)" opacity="0.7" />
    </svg>
  )
}
