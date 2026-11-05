import { createContext, useContext } from 'react'

/** 화면 아래에 잠깐 뜨는 안내를 띄운다 (예: 주소를 복사했어요) */
export type ShowFlash = (message: string) => void

export const FlashContext = createContext<ShowFlash | null>(null)

export function useFlash(): ShowFlash {
  const show = useContext(FlashContext)
  if (!show) throw new Error('useFlash는 FlashProvider 안에서만 쓸 수 있어요')
  return show
}
