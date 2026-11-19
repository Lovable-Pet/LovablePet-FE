import { useEffect, useState } from 'react'
import { clearVoiceLog, formatVoiceLog, formatVoiceLogEntry, useVoiceLog, VOICE_LOG_SIZE } from '../voiceLog'

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
 * 개발 모드 ?debug 의 음성 인식 기록 (ArPage 에서 import.meta.env.DEV 일 때만 그려 배포 파일에는 들어가지 않는다).
 * 처음에는 한 줄로 접혀 있고, 펼치면 최근 기록 (새것이 위). '복사' 는 오래된 것부터 한 줄씩.
 * 아래 오버레이 안이라 누를 때 XR select 가 되지 않는다
 */
export function VoiceLogDebug() {
  const entries = useVoiceLog()
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 1500)
    return () => window.clearTimeout(timer)
  }, [notice])

  const copy = async () => {
    const text = formatVoiceLog(entries)
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
    <div className="pointer-events-auto self-start rounded-md bg-black/65 px-2 py-1 font-mono text-[10px] leading-snug text-lime-300">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className={button}>
          [dev {open ? '▾' : '▸'}] 음성 기록 {entries.length}/{VOICE_LOG_SIZE}
        </button>
        <button type="button" onClick={copy} disabled={!entries.length} className={button}>
          복사
        </button>
        <button type="button" onClick={clearVoiceLog} disabled={!entries.length} className={button}>
          지우기
        </button>
        {notice && <span>{notice}</span>}
      </div>
      {open && (
        <div className="mt-1 max-h-[30vh] overflow-y-auto whitespace-pre-wrap select-text [overflow-wrap:anywhere]">
          {entries.length ? entries.map((entry) => <p key={entry.at}>{formatVoiceLogEntry(entry)}</p>) : '마이크를 눌러 말해 보세요'}
        </div>
      )}
    </div>
  )
}
