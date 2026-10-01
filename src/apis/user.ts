import { apiClient } from './client'
import type { CheckUsernameParams, CheckUsernameResponse } from './dto/user.dto'

export const userApi = {
  checkUsername: (params: CheckUsernameParams) =>
    apiClient.get<CheckUsernameResponse>('/auth/check-username', { params }),
}
