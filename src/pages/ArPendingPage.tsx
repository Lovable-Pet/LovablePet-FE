import { Box } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { buttonStyles } from '../components/Button/buttonStyles'

/** /pets/:petId/ar — AR 화면(6단계) 전까지 보이는 안내 */
export function ArPendingPage() {
  const { petId } = useParams()
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center justify-center gap-2 bg-canvas px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <Box className="mb-2 size-11 text-accent" strokeWidth={1.6} aria-hidden />
      <p className="text-subtitle font-bold">AR 보기는 곧 열려요.</p>
      <Link
        to={petId ? `/pets/${petId}` : '/'}
        replace
        className={buttonStyles({ variant: 'dark', size: 'md', className: 'mt-4' })}
      >
        상세로 돌아가기
      </Link>
    </div>
  )
}
