/** 아이디: 영문·숫자·밑줄 4~20자 (백엔드 /auth/check-username, /auth/signup 규칙) */
export const USERNAME_RULE = /^[A-Za-z0-9_]{4,20}$/
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
export const NICKNAME_MAX = 50

/** 백엔드 에러 코드 */
export const AUTH_ERROR = {
  CREDENTIALS: 'AUTH_401_CREDENTIALS',
  INACTIVE: 'AUTH_403_INACTIVE',
  KAKAO_CODE: 'AUTH_401_KAKAO',
  USERNAME_TAKEN: 'AUTH_409_USERNAME',
  EMAIL_TAKEN: 'AUTH_409_EMAIL',
  VALIDATION: 'COMMON_400',
} as const
