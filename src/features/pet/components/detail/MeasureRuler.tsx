export interface MeasureRulerProps {
  /** 채울 길이 (cm) */
  valueCm: number
}

const WIDTH = 310
const BAR_HEIGHT = 22

/**
 * 체고만큼 노랗게 채운 줄자. 캔버스: 0~80cm, 10cm마다 눈금(20cm마다 길게), 20cm마다 숫자.
 * 눈금 끝은 체고보다 넉넉한 40의 배수(40·80·120…)라서 숫자가 10cm 단위로 떨어진다
 */
const rulerMaxOf = (valueCm: number) => Math.max(40, Math.ceil((valueCm * 1.25) / 40) * 40)

export function MeasureRuler({ valueCm }: MeasureRulerProps) {
  const max = rulerMaxOf(valueCm)
  const step = max / 8
  const fill = Math.min(valueCm / max, 1) * WIDTH
  const ticks = Array.from({ length: 7 }, (_, index) => (index + 1) * step)
  const labels = Array.from({ length: 5 }, (_, index) => index * (max / 4))

  return (
    <svg
      viewBox={`0 0 ${WIDTH} 44`}
      role="img"
      aria-label={`0에서 ${max}cm 눈금 중 ${valueCm}cm까지 채워진 줄자`}
      className="mt-4 block h-auto w-full"
    >
      <rect x="0" y="0" width={WIDTH} height={BAR_HEIGHT} rx="4" className="fill-dark-track" />
      <rect x="0" y="0" width={fill} height={BAR_HEIGHT} rx="4" className="fill-measure" />
      {ticks.map((cm, index) => {
        const x = (cm / max) * WIDTH
        // 20cm마다(짝수 번째) 길게
        const long = index % 2 === 1
        return (
          <line
            key={cm}
            x1={x}
            y1="0"
            x2={x}
            y2={long ? 12 : 8}
            strokeWidth="1.4"
            className={x <= fill ? 'stroke-ink' : 'stroke-ink-caption'}
          />
        )
      })}
      {labels.map((cm, index) => (
        <text
          key={cm}
          x={(cm / max) * WIDTH}
          y="38"
          textAnchor={index === 0 ? 'start' : index === labels.length - 1 ? 'end' : 'middle'}
          className="fill-on-dark-tertiary font-mono text-[11px]"
        >
          {cm}
        </text>
      ))}
    </svg>
  )
}
