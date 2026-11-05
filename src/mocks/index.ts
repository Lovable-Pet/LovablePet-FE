import type { AnyHandler } from 'msw'
import { adminHandlers } from './handlers/admin'
import { healthHandlers } from './handlers/health'
import { petHandlers } from './handlers/pet'

// 도메인별 핸들러를 여기에
export const handlers: AnyHandler[] = [...healthHandlers, ...petHandlers, ...adminHandlers]
