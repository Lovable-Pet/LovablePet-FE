import { http, HttpResponse } from 'msw'

// 목업 공고 사진 (/mock/photos/{id}-{n}.jpg). 실제 파일 대신 따뜻한 회색 바탕에 번호를 그린 SVG를 돌려준다
const TINTS = ['#E8DCCB', '#EEEAE2', '#DAD6CF', '#E9D9C2', '#E4DED6', '#D9D2C6']

const photoSvg = (petId: number, photoNumber: number) => {
  const tint = TINTS[(petId + photoNumber) % TINTS.length]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <rect width="600" height="600" fill="${tint}"/>
  <ellipse cx="300" cy="350" rx="150" ry="110" fill="#1A1A17" opacity="0.12"/>
  <circle cx="300" cy="230" r="80" fill="#1A1A17" opacity="0.12"/>
  <text x="300" y="540" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#5E5D57">목업 사진 ${petId}-${photoNumber + 1}</text>
</svg>`
}

export const photoHandlers = [
  http.get('/mock/photos/:file', ({ params }) => {
    const match = String(params.file).match(/^(\d+)-(\d+)\./)
    const [petId, photoNumber] = match ? [Number(match[1]), Number(match[2])] : [0, 0]
    return new HttpResponse(photoSvg(petId, photoNumber), { headers: { 'Content-Type': 'image/svg+xml' } })
  }),
]
