import { useEffect, useRef, useState } from 'react'
import { clearArEvents, EVENT_LOG_KEEP_MS, formatArEvent, formatArEvents, useArEvents } from './eventLog'

/** 클립보드 API 가 막혔을 때 (권한·포커스) 고른 글자를 복사한다 */
function copyBySelection(text: string) {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  return ok
}

/**
 * 개발 모드 ?debug 의 이벤트 기록 (AR·?sim 모두, ArPage 에서 import.meta.env.DEV 일 때만 그린다).
 * 처음에는 한 줄로 접혀 있고, 펼치면 최근 10분 (새것이 아래, 끝으로 스크롤). '복사' 는 텍스트 한 덩어리 (시간은 초, 소수 둘째 자리)
 */
export function ArEventLog() {
  const events = useArEvents()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1500)
    return () => window.clearTimeout(timer)
  }, [notice])
  // 펼쳐 둔 동안 새 기록이 오면 끝으로
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [open, events])

  const copy = async () => {
    const text = formatArEvents(events)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setNotice('복사함')
    } catch {
      setNotice(copyBySelection(text) ? '복사함' : '복사 못 함 · 펼쳐서 길게 눌러 고르세요')
    }
  }

  const button = 'rounded bg-white/10 px-1.5 py-0.5 active:bg-white/25'
  return (
    <div className="pointer-events-auto self-start rounded-md bg-black/65 px-2 py-1 font-mono text-[10px] leading-snug text-sky-200">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={button}>
          [dev {open ? '▾' : '▸'}] 이벤트 {events.length} (최근 {EVENT_LOG_KEEP_MS / 60000}분)
        </button>
        <button type="button" onClick={copy} disabled={!events.length} className={button}>
          복사
        </button>
        <button type="button" onClick={clearArEvents} disabled={!events.length} className={button}>
          지우기
        </button>
        {notice && <span>{notice}</span>}
      </div>
      {open && (
        <div ref={listRef}className="mt-1 max-h-[30vh] overflow-y-auto whitespace-pre-wrap select-text [overflow-wrap:anywhere]">
          {events.length ? events.map((event, i) => <p key={`${event.t}-${i}`}>{formatArEvent(event)}</p>) : '아직 없어요'}
        </div>
      )}
    </div>
  )
}
