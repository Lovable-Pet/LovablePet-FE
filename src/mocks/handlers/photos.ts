import { http, HttpResponse } from 'msw'

// 목업 공고 사진 (/mock/photos/{id}-{n}.jpg). 실제 파일 대신 파스텔 바탕에 강아지 발바닥을 그린 SVG를 돌려준다.
// 사진이 없는 공고의 빈 타일(PetPhoto)과 같은 모습이다
const TINTS = [
  { background: '#FFC9D1', paw: '#D43D5A' },
  { background: '#BFE8CD', paw: '#24744A' },
  { background: '#F6B66F', paw: '#94530C' },
  { background: '#CFE0FF', paw: '#3A66C4' },
]

const photoSvg = (petId: number, photoNumber: number) => {
  const tint = TINTS[(petId + photoNumber) % TINTS.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="${tint.background}"/>
  <g transform="translate(180 180) scale(10)" fill="none" stroke="${tint.paw}" stroke-opacity="0.45" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="4" r="2"/>
    <circle cx="18" cy="8" r="2"/>
    <circle cx="20" cy="16" r="2"/>
    <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>
  </g>
</svg>`
}

export const photoHandlers = [
  http.get('/mock/photos/:file', ({ params }) => {
    const match = String(params.file).match(/^(\d+)-(\d+)\./)
    const [petId, photoNumber] = match ? [Number(match[1]), Number(match[2])] : [0, 0]
    return new HttpResponse(photoSvg(petId, photoNumber), { headers: { 'Content-Type': 'image/svg+xml' } })
  }),
]
