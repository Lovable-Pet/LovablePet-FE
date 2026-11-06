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

/**
 * 하단 탭이 있는 화면 (둘러보기·찜·마이).
 * 모바일은 화면 전체 폭, 태블릿·데스크톱은 480px 휴대폰 너비로 가운데 (docs/responsive-interaction.md)
 */
export function TabLayout() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas pt-[env(safe-area-inset-top)]">
      <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <nav
        aria-label="하단 메뉴"
        // 토스트가 탭 위에 뜨게 (index.css --toast-offset)
        data-bottom-bar="tab"
        className="fixed inset-x-0 bottom-0 z-10 mx-auto grid h-[calc(72px+env(safe-area-inset-bottom))] w-full max-w-[480px] grid-cols-3 border-t border-line bg-surface pb-[calc(8px+env(safe-area-inset-bottom))]"
      >
        {TABS.map(({ to, label, Icon, fillWhenActive }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 text-tab transition',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                isActive ? 'font-semibold text-accent' : 'text-ink-tertiary hover:text-ink',
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
