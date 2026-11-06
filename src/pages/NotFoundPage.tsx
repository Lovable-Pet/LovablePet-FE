import { Link } from 'react-router'
import { buttonStyles } from '../components/Button/buttonStyles'

/** 없는 주소 */
export function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-2 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <p className="text-subtitle font-bold">찾는 화면이 없어요</p>
      <p className="text-body text-ink-tertiary">주소가 바뀌었거나 없는 화면이에요.</p>
      <Link to="/" className={buttonStyles({ variant: 'dark', size: 'md', className: 'mt-4' })}>
        둘러보기로 가기
      </Link>
    </div>
  )
}
