import type { ReactNode } from 'react'
import { FlashMessage } from '../components/FlashMessage/FlashMessage'
import { useFlashMessage } from '../hooks/useFlashMessage'
import { FlashContext } from './flash'

/** 앱 어디서든 useFlash()로 토스트를 띄운다 (3초) */
export function FlashProvider({ children }: { children: ReactNode }) {
  const { flash, show } = useFlashMessage()
  return (
    <FlashContext.Provider value={show}>
      {children}
      <FlashMessage flash={flash} />
    </FlashContext.Provider>
  )
}
