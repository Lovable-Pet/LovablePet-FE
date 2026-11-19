const KEY = 'lp.welcomed'

/** 시작 화면을 이미 봤는지. 저장소를 쓸 수 없으면 본 것으로 친다 (매번 막지 않게) */
export const hasWelcomed = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export const markWelcomed = () => {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // 무시
  }
}
