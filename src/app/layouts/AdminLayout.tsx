import { Link, Outlet, useLocation } from 'react-router'
import { Badge } from '../../components/Badge/Badge'
import { Logo } from '../../components/Logo/Logo'
import { cn } from '../../components/utils/cn'

const NAV = [
  // AR 만들기(/admin/pets/:id/model)도 'AR 모델 만들기' 메뉴 안이다
  { to: '/admin', label: 'AR 모델 만들기', match: (path: string) => path === '/admin' || path.startsWith('/admin/pets') },
  { to: '/admin/models', label: '생성 기록', match: (path: string) => path.startsWith('/admin/models') },
]

/**
 * 관리자 화면 (목록·관리). 진한 상단 바 + 본문 최대 1160px 가운데.
 * 좌우 여백은 모바일 20 / 태블릿 32 / 데스크톱 40 (box-content 라 1160 은 여백을 뺀 본문 폭)
 */
const CONTAINER = 'mx-auto box-content max-w-[1160px] px-5 tablet:px-8 desktop:px-10'

export function AdminLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-ink pt-[env(safe-area-inset-top)] text-white">
        <div className={`${CONTAINER} flex min-h-16 flex-wrap items-center gap-x-6 gap-y-2 py-2`}>
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-emphasis font-bold">LovablePet</span>
            <Badge tone="measure" size="sm">
              관리자
            </Badge>
          </div>
          <nav aria-label="관리자 메뉴" className="flex flex-1 gap-1">
            {NAV.map(({ to, label, match }) => {
              const active = match(pathname)
              return (
                <Link
                  key={to}
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center rounded-button-sm px-3.5 text-body whitespace-nowrap transition',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-measure',
                    active ? 'bg-white/12 font-semibold text-white' : 'text-on-dark-secondary hover:bg-white/6 hover:text-white',
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <Link to="/" className="text-label text-on-dark-secondary touch-target hover:text-white">
            앱으로 돌아가기
          </Link>
        </div>
      </header>
      <main className={`${CONTAINER} pt-7 pb-[calc(48px+env(safe-area-inset-bottom))]`}>
        <Outlet />
      </main>
    </div>
  )
}
