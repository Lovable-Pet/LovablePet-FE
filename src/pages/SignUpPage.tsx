import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import type { SignUpRequest } from '../apis/dto/auth.dto'
import { tokenStorage } from '../apis/tokenStorage'
import { userApi } from '../apis/user'
import { Button } from '../components/Button/Button'
import { Field } from '../components/Field/Field'
import { AUTH_ERROR, NICKNAME_MAX, PASSWORD_MAX, PASSWORD_MIN, USERNAME_RULE } from '../constants/auth'
import { AuthHeader } from '../features/auth/AuthHeader'
import { safeRedirect, withRedirect } from '../features/auth/redirect'

/** 아이디 중복 확인 상태 (캔버스 11: idle · ok · taken) */
type UsernameCheck = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid' | 'failed'

type FieldName = keyof SignUpRequest
type FieldErrors = Partial<Record<FieldName, string>>

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validate = (form: SignUpRequest, check: UsernameCheck): FieldErrors => {
  const errors: FieldErrors = {}
  if (!USERNAME_RULE.test(form.username)) errors.username = '영문·숫자·밑줄 4~20자로 입력해 주세요.'
  else if (check === 'taken') errors.username = '이미 쓰고 있는 아이디예요.'
  else if (check !== 'ok') errors.username = '아이디 중복 확인을 해 주세요.'
  if (!EMAIL_RULE.test(form.email)) errors.email = '이메일 주소를 확인해 주세요.'
  if (form.password.length < PASSWORD_MIN || form.password.length > PASSWORD_MAX)
    errors.password = `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해 주세요.`
  if (!form.nickname.trim()) errors.nickname = '닉네임을 입력해 주세요.'
  return errors
}

export function SignUpPage() {
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))
  const navigate = useNavigate()

  const [form, setForm] = useState<SignUpRequest>({ username: '', email: '', password: '', nickname: '' })
  const [check, setCheck] = useState<UsernameCheck>('idle')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)

  const update = (name: FieldName, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
    // 아이디를 바꾸면 중복 확인을 다시 해야 한다
    if (name === 'username') setCheck('idle')
  }

  const checkUsername = useMutation({
    mutationFn: (username: string) => userApi.checkUsername({ username }),
    onMutate: () => setCheck('checking'),
    onSuccess: ({ available }) => setCheck(available ? 'ok' : 'taken'),
    onError: (error) => setCheck(error instanceof ApiError && error.status === 400 ? 'invalid' : 'failed'),
  })

  const signUp = useMutation({
    mutationFn: (body: SignUpRequest) => authApi.signUp(body),
    onSuccess: (tokens) => {
      tokenStorage.save(tokens)
      navigate(redirect, { replace: true })
    },
    onError: (error) => {
      if (!(error instanceof ApiError)) {
        setFormError('가입하지 못했어요. 잠시 후 다시 시도해 주세요.')
        return
      }
      if (error.code === AUTH_ERROR.USERNAME_TAKEN) {
        setCheck('taken')
        return
      }
      if (error.code === AUTH_ERROR.EMAIL_TAKEN) {
        setErrors((prev) => ({ ...prev, email: '이미 가입한 이메일이에요.' }))
        return
      }
      if (error.code === AUTH_ERROR.VALIDATION && error.details?.length) {
        // 서버 검증 사유를 해당 칸에 보여 준다
        const fieldErrors: FieldErrors = {}
        error.details.forEach(({ field, reason }) => {
          if (field in form) fieldErrors[field as FieldName] = reason
        })
        setErrors(fieldErrors)
        return
      }
      setFormError('가입하지 못했어요. 잠시 후 다시 시도해 주세요.')
    },
  })

  const onCheck = () => {
    if (!USERNAME_RULE.test(form.username)) {
      setCheck('invalid')
      return
    }
    checkUsername.mutate(form.username)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const nextErrors = validate(form, check)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    signUp.mutate({ ...form, nickname: form.nickname.trim() })
  }

  const usernameMessage = {
    idle: { hint: '영문·숫자·밑줄 4~20자, 로그인할 때 써요.' },
    checking: { hint: '확인하는 중…' },
    ok: { success: '사용할 수 있는 아이디예요.' },
    taken: { error: '이미 쓰고 있는 아이디예요.' },
    invalid: { error: '영문·숫자·밑줄 4~20자로 입력해 주세요.' },
    failed: { error: '확인하지 못했어요. 다시 눌러 주세요.' },
  }[check]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-canvas">
      <AuthHeader kind="back" title="회원가입" fallback={withRedirect('/login', redirect)} />

      <form id="signup-form" onSubmit={submit} noValidate className="flex flex-col gap-5 px-6 pt-4">
        <Field
          label="아이디"
          autoComplete="username"
          value={form.username}
          onChange={(event) => update('username', event.target.value)}
          hint={usernameMessage.hint}
          success={usernameMessage.success}
          error={errors.username ?? usernameMessage.error}
          trailing={
            <Button
              variant="outline-strong"
              size="field"
              onClick={onCheck}
              disabled={checkUsername.isPending}
            >
              중복 확인
            </Button>
          }
        />
        <Field
          label="이메일"
          type="email"
          autoComplete="email"
          placeholder="name@example.com"
          value={form.email}
          onChange={(event) => update('email', event.target.value)}
          hint="연락이 필요할 때만 써요."
          error={errors.email}
        />
        <Field
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={(event) => update('password', event.target.value)}
          hint={`${PASSWORD_MIN}~${PASSWORD_MAX}자로 정해 주세요.`}
          error={errors.password}
        />
        <Field
          label="닉네임"
          maxLength={NICKNAME_MAX}
          placeholder="화면에 보일 이름"
          value={form.nickname}
          onChange={(event) => update('nickname', event.target.value)}
          error={errors.nickname}
        />
      </form>

      <div className="mt-auto px-6 pt-8 pb-8">
        {formError && (
          <p role="alert" className="mb-3 text-center text-label text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" form="signup-form" fullWidth disabled={signUp.isPending}>
          {signUp.isPending ? '가입하는 중…' : '가입하고 시작하기'}
        </Button>
      </div>
    </div>
  )
}
