import type { ReactNode } from 'react'
import { Character } from '../../components/Character/Character'
import { PageHeader } from '../../components/PageHeader/PageHeader'
import { useGoBack } from '../../hooks/useGoBack'

/** 로그인·회원가입 화면의 틀: 뒤로 버튼, 큰 제목, 분홍 동그라미와 신난 강아지 */
export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const goBack = useGoBack('/')
  return (
    <div className="app-column relative overflow-hidden pb-[calc(32px+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))]">
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-14 size-56 rounded-full bg-pink-soft" />
      <div aria-hidden className="pointer-events-none absolute top-[calc(28px+env(safe-area-inset-top))] right-5">
        <Character name="happy" size={112} />
      </div>
      <div className="relative">
        <PageHeader onBack={goBack} />
        <main className="px-5 pt-10">
          <h1 className="font-display text-title">{title}</h1>
          <p className="mt-1.5 max-w-[60%] text-body text-ink-soft">{description}</p>
          {children}
        </main>
      </div>
    </div>
  )
}
