#!/usr/bin/env node
// 가짜 파이프라인. 스프링을 로컬로 띄워 AR 생성 흐름(적합도 → 작업 → 콜백 → GLB·USDZ 저장 → 상세 API)을
// 시험할 때 Python 파이프라인(localhost:8000) 대신 띄운다. 모델을 새로 만들지 않고, 이 묶음의 진도 9마리 중
// 같은 유기번호가 있으면 그 개, 없으면 체중이 가장 가까운 개의 GLB·USDZ 를 돌려준다. 비용·외부 호출 없음.
//
//   node fake-pipeline/fake-pipeline.mjs
//
// 환경변수
//   PORT               8000 (스프링 pet-pipeline.base-url 기본값 http://localhost:8000)
//   FAKE_PIPELINE_KEY  local-dev-key (스프링 pet-pipeline.api-key 기본값과 같다. 콜백에도 이 키를 붙인다)
//   FAKE_JOB_SECONDS   15 (작업이 끝나기까지. 진짜는 1.5~4분)
//   FAKE_OUTCOME       done | photo_rejected | failed | unsuitable (실패 화면 시험용, 기본 done)
//   FAKE_MODELS_DIR    GLB·USDZ 폴더 (기본: 이 파일 옆의 ../public/mock/models)
//
// 계약은 LovablePet-AI-AR 저장소 docs/API.md. Node 18 이상, 의존성 없음.
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8000)
const KEY = process.env.FAKE_PIPELINE_KEY || 'local-dev-key'
const JOB_SECONDS = Number(process.env.FAKE_JOB_SECONDS || 15)
const OUTCOME = process.env.FAKE_OUTCOME || 'done'
const MODELS = process.env.FAKE_MODELS_DIR || path.join(here, '..', 'public', 'mock', 'models')
const SAMPLES = JSON.parse(fs.readFileSync(path.join(here, 'samples.json'), 'utf8'))
// 진도 템플릿 개의 클립 (대기 루프 standing, 아이폰 USDZ 도 standing)
const CLIPS = ['idle', 'standing', 'sitting', 'shake', 'tail_wag', 'bark', 'lying', 'sit_down', 'stand_up',
  'lie_down', 'get_up', 'play_dead', 'rollover']
const PHOTO = { level: 'good', levels: { size: 'good', sharpness: 'good', exposure: 'good' },
  short_side_px: 800, sharpness: 300.0, clipped_share: 0.01 }
const REJECTED = '사진에서 사람이 개를 크게 가리고 있어요 (가짜 파이프라인)'

const jobs = new Map()
const now = () => new Date().toISOString()

for (const s of SAMPLES) {
  for (const ext of ['glb', 'usdz']) {
    const file = path.join(MODELS, s.desertionNo, `${s.desertionNo}-mock.${ext}`)
    if (!fs.existsSync(file)) throw new Error(`없는 모델 파일: ${file} (FAKE_MODELS_DIR 확인)`)
  }
}

/** 같은 유기번호의 샘플, 없으면 체중이 가장 가까운 샘플 */
function pick(petId, weightKg) {
  return SAMPLES.find((s) => s.desertionNo === petId)
    ?? [...SAMPLES].sort((a, b) => Math.abs(a.weightKg - weightKg) - Math.abs(b.weightKg - weightKg))[0]
}

function fit(sample, rejected) {
  return {
    level: rejected ? 'poor' : 'good', label: rejected ? '부적합' : '적합', score: rejected ? 0 : 100,
    reasons: rejected ? [REJECTED] : [],
    notes: [`가짜 파이프라인: 진도 샘플 ${sample.desertionNo}(${sample.weightKg}kg)의 모델을 씁니다`],
    template: 'jindo', picked_by: 'looks', match: 'close', differences: [], looks: 'jindo',
    photo_rejected: rejected ? ['person_covers'] : [],
  }
}

/** 스프링이 보내는 기록 {pet_id, weight_kg, ...} 또는 보호소 원문 {관리번호, 몸무게, ...} */
function readRecord(record) {
  const petId = String(record.pet_id ?? record['관리번호'] ?? 'pet')
  const weightKg = Number(record.weight_kg ?? record['몸무게'] ?? 10)
  return { petId, weightKg }
}

async function readForm(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const form = await new Response(Buffer.concat(chunks), {
    headers: { 'content-type': req.headers['content-type'] || '' },
  }).formData()
  const text = async (name) => {
    const v = form.get(name)
    return v == null ? null : typeof v === 'string' ? v : await v.text()
  }
  return {
    record: JSON.parse((await text('record')) || '{}'),
    hasPhoto: form.has('photo'),
    callbackUrl: await text('callback_url'),
    fitStop: (await text('fit_stop')) === 'true',
  }
}

function finish(id) {
  const entry = jobs.get(id)
  if (!entry) return
  const { job, sample, weightKg } = entry
  // unsuitable 은 진짜처럼 fit_stop=true 일 때만 (아니면 그대로 만든다)
  const outcome = OUTCOME === 'unsuitable' && !entry.fitStop ? 'done' : OUTCOME
  Object.assign(job, { status: outcome, finished_at: now(), seconds: JOB_SECONDS, cost_usd: 0 })
  if (outcome === 'done') {
    Object.assign(job, {
      fit: fit(sample, false), photo: PHOTO,
      size: { weight_kg: weightKg, withers_m: sample.withersM, scale: 1.0, rule: 'weight' },
      model: {
        glb_url: `/v1/jobs/${id}/files/model.glb`, usdz_url: `/v1/jobs/${id}/files/model.usdz`,
        texture_url: null, renders: {},
      },
      animations: CLIPS,
      behavior: { playback_rate: 1.0, tap_animation: 'tail_wag', tap_is_retreat: false },
    })
  } else if (outcome === 'photo_rejected') {
    Object.assign(job, { fit: fit(sample, true), reasons: [REJECTED], error: 'photo rejected (fake)' })
  } else if (outcome === 'unsuitable') {
    Object.assign(job, { fit: { ...fit(sample, false), level: 'poor', label: '부적합', score: 30,
      reasons: ['사진 속 개가 템플릿과 많이 달라요 (가짜 파이프라인)'] } })
  } else {
    Object.assign(job, { status: 'failed', error: 'fake failure (FAKE_OUTCOME)' })
  }
  console.log(`[job] ${id} -> ${job.status}${outcome === 'done' ? ` (샘플 ${sample.desertionNo})` : ''}`)
  if (entry.callbackUrl) sendCallback(entry.callbackUrl, job, 0)
}

/** 진짜처럼 2xx 가 아니면 세 번까지 다시 보낸다 */
async function sendCallback(url, job, attempt) {
  try {
    const res = await fetch(url, {
      method: 'POST', headers: { 'content-type': 'application/json', 'X-API-Key': KEY }, body: JSON.stringify(job),
    })
    console.log(`[callback] ${job.job_id} ${job.status} -> ${res.status}`)
    if (res.ok) return
  } catch (error) {
    console.log(`[callback] ${job.job_id} 실패: ${error.message}`)
  }
  if (attempt < 2) setTimeout(() => sendCallback(url, job, attempt + 1), 5000)
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers })
  res.end(body === undefined ? undefined : JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const parts = url.pathname.split('/').filter(Boolean)
  console.log(`${req.method} ${url.pathname}`)
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      const running = [...jobs.values()].filter((e) => e.job.status === 'running').length
      const queued = [...jobs.values()].filter((e) => e.job.status === 'queued').length
      return send(res, 200, { ok: true, blender: false, openai_key: false, running, queued, fake: true })
    }
    if (parts[0] !== 'v1') return send(res, 404, { detail: 'not found' })
    if (req.headers['x-api-key'] !== KEY) return send(res, 401, { detail: 'invalid api key' })

    if (req.method === 'POST' && url.pathname === '/v1/fit') {
      const { record, hasPhoto } = await readForm(req)
      if (!hasPhoto || !record) return send(res, 422, { detail: 'record/photo missing' })
      const { petId, weightKg } = readRecord(record)
      const sample = pick(petId, weightKg)
      if (OUTCOME === 'photo_rejected') {
        return send(res, 200, { pet_id: petId, fit: fit(sample, true), size: null, shape: null, photo: null })
      }
      return send(res, 200, {
        pet_id: petId, fit: fit(sample, false),
        size: { weight_kg: weightKg, withers_m: sample.withersM, scale: 1.0, rule: 'weight' },
        shape: { ears: 'erect', tail_carriage: 'up', build: 'medium' }, photo: PHOTO,
      })
    }

    if (req.method === 'POST' && url.pathname === '/v1/jobs') {
      const { record, hasPhoto, callbackUrl, fitStop } = await readForm(req)
      if (!hasPhoto || !record) return send(res, 422, { detail: 'record/photo missing' })
      const { petId, weightKg } = readRecord(record)
      const id = `${petId}-${crypto.randomBytes(4).toString('hex')}`
      const job = { job_id: id, pet_id: petId, status: 'queued', created_at: now() }
      jobs.set(id, { job, sample: pick(petId, weightKg), weightKg, callbackUrl, fitStop })
      setTimeout(() => {
        if (job.status === 'queued') Object.assign(job, { status: 'running', started_at: now() })
      }, 1000)
      setTimeout(() => finish(id), JOB_SECONDS * 1000)
      return send(res, 202, job, { location: `/v1/jobs/${id}` })
    }

    const entry = parts[1] === 'jobs' && parts[2] ? jobs.get(parts[2]) : undefined
    if (parts[1] === 'jobs' && parts[2] && !entry) return send(res, 404, { detail: 'no such job' })

    if (req.method === 'GET' && parts.length === 3) return send(res, 200, entry.job)

    if (req.method === 'GET' && parts.length === 5 && parts[3] === 'files') {
      const ext = { 'model.glb': 'glb', 'model.usdz': 'usdz' }[parts[4]]
      if (!ext || entry.job.status !== 'done') return send(res, 404, { detail: 'no such file' })
      const no = entry.sample.desertionNo
      const file = path.join(MODELS, no, `${no}-mock.${ext}`)
      res.writeHead(200, {
        'content-type': ext === 'glb' ? 'model/gltf-binary' : 'model/vnd.usdz+zip',
        'content-length': fs.statSync(file).size,
      })
      return fs.createReadStream(file).pipe(res)
    }

    if (req.method === 'DELETE' && parts.length === 3) {
      if (['queued', 'running'].includes(entry.job.status)) return send(res, 409, { detail: 'job still running' })
      jobs.delete(parts[2])
      res.writeHead(204)
      return res.end()
    }
    return send(res, 404, { detail: 'not found' })
  } catch (error) {
    console.error(error)
    return send(res, 500, { detail: String(error.message || error) })
  }
})

server.listen(PORT, () => {
  console.log(`가짜 파이프라인 http://localhost:${PORT} (키 ${KEY}, 작업 ${JOB_SECONDS}초, 결과 ${OUTCOME}, 샘플 ${SAMPLES.length}마리)`)
})
