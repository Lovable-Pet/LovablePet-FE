import type { ComponentType } from 'react'
import { Heart, House, UserRound, type LucideProps } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '../../components/utils/cn'

interface Tab {
  to: string
  label: string
  Icon: ComponentType<LucideProps>
  /** 선택됐을 때 아이콘을 채운다 (찜 하트, 마이) */
  fillWhenActive?: boolean
}

const TABS: Tab[] = [
  { to: '/', label: '둘러보기', Icon: House },
  { to: '/favorites', label: '찜', Icon: Heart, fillWhenActive: true },
  { to: '/me', label: '마이', Icon: UserRound, fillWhenActive: true },
]

/** 하단 탭이 있는 화면 (둘러보기·찜·마이) */
export function TabLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas">
      <main className="flex-1 pb-18">
        <Outlet />
      </main>
      <nav
        aria-label="하단 메뉴"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-[calc(72px+env(safe-area-inset-bottom))] w-full max-w-[480px] grid-cols-3 border-t border-line bg-surface pb-[calc(8px+env(safe-area-inset-bottom))]"
      >
        {TABS.map(({ to, label, Icon, fillWhenActive }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 text-tab',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                isActive ? 'font-semibold text-accent' : 'text-ink-tertiary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className="size-5.5"
                  strokeWidth={1.9}
                  fill={isActive && fillWhenActive ? 'currentColor' : 'none'}
                  aria-hidden
                />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
