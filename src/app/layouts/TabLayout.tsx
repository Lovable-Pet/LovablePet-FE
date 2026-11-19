import { Heart, House, PawPrint, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '../../components/utils/cn'

const TABS = [
  { to: '/', label: '홈', icon: House, end: true },
  { to: '/search', label: '검색', icon: PawPrint, end: false },
  { to: '/favorites', label: '관심목록', icon: Heart, end: false },
  { to: '/me', label: '마이페이지', icon: UserRound, end: false },
] as const

/** 아래에 탭 네 개가 있는 화면들 (홈·검색·관심목록·마이페이지) */
export function TabLayout() {
  return (
    <div className="app-column pb-[calc(84px+env(safe-area-inset-bottom))]">
      <Outlet />
      <nav aria-label="주요 화면" className="fixed inset-x-0 bottom-0 z-40 flex justify-center">
        <ul className="flex w-full max-w-[480px] rounded-t-[1.75rem] bg-surface px-3 pt-2 pb-[calc(8px+env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgb(180_90_80/0.1)]">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-caption font-bold',
                    'transition-[color,scale] duration-150 active:scale-[0.96]',
                    isActive ? 'text-primary' : 'text-ink-mute hover:text-ink-soft',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      key={String(isActive)}
                      className={cn('size-6', isActive && 'animate-pop fill-primary')}
                      strokeWidth={isActive ? 1.5 : 1.9}
                      aria-hidden
                    />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
