import type { ReactNode } from 'react'
import { FlashMessage } from '../components/FlashMessage/FlashMessage'
import { useFlashMessage } from '../hooks/useFlashMessage'
import { FlashContext } from './flash'

/** 앱 어디서든 useFlash()로 안내를 띄운다. 하단 탭·하단 바 위에 보이게 아래에서 112px 띄운다 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const { message, show } = useFlashMessage()
  return (
    <FlashContext.Provider value={show}>
      {children}
      <FlashMessage message={message} className="bottom-28" />
    </FlashContext.Provider>
  )
}
