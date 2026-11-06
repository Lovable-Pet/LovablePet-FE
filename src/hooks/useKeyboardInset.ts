import { useEffect } from 'react'

/** 주소창이 접히고 펴지는 정도(수십 px)는 키보드로 보지 않는다 */
const KEYBOARD_MIN_HEIGHT = 120

/**
 * 가상 키보드가 가린 높이를 --keyboard-inset 에 넣는다.
 * - 아이폰: 키보드가 화면을 덮어도 레이아웃 높이가 그대로라 visualViewport 로 잰다
 * - 안드로이드 크롬: viewport 의 interactive-widget=resizes-content 로 화면이 먼저 줄어서 0 이 된다
 * 하단 고정 요소(시트 버튼 영역)는 이 값만큼 올려 키보드 위에 붙인다.
 * 키보드가 뜨면 입력 중인 칸이 가려지지 않게 보이는 곳까지 스크롤한다
 */
export function useKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement
    let lastInset = 0

    const measure = () => {
      // 손가락으로 확대한 상태는 키보드가 아니다
      if (viewport.scale > 1.01) return 0
      const covered = window.innerHeight - viewport.height - viewport.offsetTop
      return covered >= KEYBOARD_MIN_HEIGHT ? Math.round(covered) : 0
    }

    const update = () => {
      const inset = measure()
      if (inset === lastInset) return
      const opened = inset > lastInset
      lastInset = inset
      root.style.setProperty('--keyboard-inset', `${inset}px`)

      const focused = document.activeElement
      if (opened && focused instanceof HTMLElement && focused.matches('input, textarea, select')) {
        // 레이아웃이 바뀐 다음에 스크롤한다
        requestAnimationFrame(() => focused.scrollIntoView({ block: 'nearest' }))
      }
    }

    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.removeProperty('--keyboard-inset')
    }
  }, [])
}
