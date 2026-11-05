import { Link, Outlet, useLocation } from 'react-router'
import { Badge } from '../../components/Badge/Badge'
import { Logo } from '../../components/Logo/Logo'
import { cn } from '../../components/utils/cn'

const NAV = [
  // AR 만들기(/admin/pets/:id/model)도 'AR 모델 만들기' 메뉴 안이다
  { to: '/admin', label: 'AR 모델 만들기', match: (path: string) => path === '/admin' || path.startsWith('/admin/pets') },
  { to: '/admin/models', label: '생성 기록', match: (path: string) => path.startsWith('/admin/models') },
]

/** 관리자 화면 (데스크톱). 진한 상단 바 + 최대 1200px 본문 */
export function AdminLayout() {
  const { pathname } = useLocation()

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="bg-ink text-white">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2">
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
                    'flex h-10 items-center rounded-button-sm px-3.5 text-body whitespace-nowrap',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-measure',
                    active ? 'bg-white/12 font-semibold text-white' : 'text-on-dark-secondary',
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <Link to="/" className="text-label text-on-dark-secondary">
            앱으로 돌아가기
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 pt-7 pb-12">
        <Outlet />
      </main>
    </div>
  )
}
