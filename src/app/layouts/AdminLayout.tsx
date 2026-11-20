import { ChevronLeft } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router'
import { Badge } from '../../components/Badge/Badge'
import { cn } from '../../components/utils/cn'

const TABS = [
  { to: '/admin', label: '유기견 목록', end: true },
  { to: '/admin/models', label: '생성 기록', end: false },
] as const

/** 관리자 화면 틀. 표와 사진을 넓게 봐야 해서 앱 기둥(480px)보다 넓다 */
export function AdminLayout() {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[860px] bg-canvas pb-16">
      <header className="sticky top-0 z-30 bg-canvas/90 px-5 pt-[env(safe-area-inset-top)] backdrop-blur sm:px-6">
        <div className="flex h-14 items-center gap-2">
          <Link to="/" aria-label="앱으로 돌아가기" className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-pink-soft">
            <ChevronLeft className="size-6" strokeWidth={2} aria-hidden />
          </Link>
          <p className="text-emphasis font-extrabold">러버블펫</p>
          <Badge tone="info">관리자</Badge>
        </div>
        <nav aria-label="관리자 화면" className="flex gap-1 border-b border-line">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px flex h-11 items-center border-b-[3px] px-3 text-body font-bold transition-colors duration-150',
                  isActive ? 'border-primary-deep text-ink' : 'border-transparent text-ink-mute hover:text-ink',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="px-5 pt-6 sm:px-6">
        <Outlet />
      </div>
    </div>
  )
}
