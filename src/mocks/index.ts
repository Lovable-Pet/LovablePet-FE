import type { AnyHandler } from 'msw'
import { adminHandlers } from './handlers/admin'
import { authHandlers } from './handlers/auth'
import { healthHandlers } from './handlers/health'
import { petHandlers } from './handlers/pet'
import { photoHandlers } from './handlers/photos'

// 도메인별 핸들러를 여기에
export const handlers: AnyHandler[] = [...healthHandlers, ...authHandlers, ...petHandlers, ...adminHandlers, ...photoHandlers]
