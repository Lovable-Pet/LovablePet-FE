import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { ApiError } from '../apis/apiError'
import { authApi } from '../apis/auth'
import type { SignUpRequest } from '../apis/dto/auth.dto'
import { tokenStorage } from '../apis/tokenStorage'
import { userApi } from '../apis/user'
import { Button } from '../components/Button/Button'
import { Field } from '../components/Field/Field'
import { AUTH_ERROR, NICKNAME_MAX, PASSWORD_MAX, PASSWORD_MIN, USERNAME_RULE } from '../constants/auth'
import { AuthShell } from '../features/auth/AuthShell'
import { safeRedirect, withRedirect } from '../features/auth/redirect'
import { useAuth } from '../features/auth/useAuth'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

type FieldName = keyof SignUpRequest
type FieldErrors = Partial<Record<FieldName, string>>

const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validate = (form: SignUpRequest): FieldErrors => {
  const errors: FieldErrors = {}
  if (!USERNAME_RULE.test(form.username)) errors.username = '영문, 숫자, 밑줄로 4~20자를 입력해 주세요.'
  if (!EMAIL_RULE.test(form.email)) errors.email = '이메일 주소를 다시 확인해 주세요.'
  if (form.password.length < PASSWORD_MIN || form.password.length > PASSWORD_MAX)
    errors.password = `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력해 주세요.`
  if (!form.nickname.trim()) errors.nickname = '닉네임을 입력해 주세요.'
  else if (form.nickname.length > NICKNAME_MAX) errors.nickname = `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`
  return errors
}

// /signup?redirect=… — 가입하면 바로 로그인된 상태로 redirect 로 돌아간다
export function SignUpPage() {
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = safeRedirect(searchParams.get('redirect'))

  const [form, setForm] = useState<SignUpRequest>({ username: '', email: '', password: '', nickname: '' })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // 아이디는 입력을 멈추면 바로 쓸 수 있는지 확인한다
  const debouncedUsername = useDebouncedValue(form.username, 400)
  const usernameValid = USERNAME_RULE.test(debouncedUsername)
  const usernameCheck = useQuery({
    queryKey: ['auth', 'check-username', debouncedUsername],
    queryFn: () => userApi.checkUsername({ username: debouncedUsername }),
    enabled: usernameValid,
    staleTime: 30_000,
    retry: false,
  })
  const checked = usernameValid && debouncedUsername === form.username ? usernameCheck.data : undefined

  if (isLoggedIn) return <Navigate to={redirect} replace />

  const change = (name: FieldName) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [name]: event.target.value }))
    setErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found = validate(form)
    if (checked?.available === false) found.username = '이미 쓰고 있는 아이디예요.'
    setErrors(found)
    setFormError(null)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      tokenStorage.save(await authApi.signUp({ ...form, nickname: form.nickname.trim() }))
      navigate(redirect, { replace: true })
    } catch (caught) {
      setSubmitting(false)
      if (caught instanceof ApiError) {
        if (caught.code === AUTH_ERROR.USERNAME_TAKEN) return setErrors({ username: '이미 쓰고 있는 아이디예요.' })
        if (caught.code === AUTH_ERROR.EMAIL_TAKEN) return setErrors({ email: '이미 가입한 이메일이에요.' })
        if (caught.code === AUTH_ERROR.VALIDATION && caught.details?.length) {
          return setErrors(
            Object.fromEntries(caught.details.map((detail) => [detail.field, detail.reason])) as FieldErrors,
          )
        }
      }
      setFormError('가입하지 못했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <AuthShell title="처음 오셨군요" description="가입하면 마음이 가는 유기견을 찜해 둘 수 있어요.">
      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-4">
        <Field
          label="아이디"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={20}
          value={form.username}
          onChange={change('username')}
          hint="영문, 숫자, 밑줄 4~20자"
          error={errors.username ?? (checked?.available === false ? '이미 쓰고 있는 아이디예요.' : null)}
          success={checked?.available ? '쓸 수 있는 아이디예요.' : null}
        />
        <Field
          label="이메일"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={change('email')}
          error={errors.email}
        />
        <Field
          label="비밀번호"
          name="password"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX}
          value={form.password}
          onChange={change('password')}
          hint={`${PASSWORD_MIN}자 이상`}
          error={errors.password}
        />
        <Field
          label="닉네임"
          name="nickname"
          autoComplete="nickname"
          maxLength={NICKNAME_MAX}
          value={form.nickname}
          onChange={change('nickname')}
          error={errors.nickname}
        />
        {formError && (
          <p role="alert" className="rounded-tile bg-pink-soft px-4 py-3 text-label font-bold text-pink-deep">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full disabled={submitting} className="mt-2">
          {submitting ? '가입하는 중' : '가입하기'}
        </Button>
      </form>

      <p className="mt-8 text-center text-label text-ink-soft">
        이미 계정이 있나요?{' '}
        <Link to={withRedirect('/login', redirect)} replace className="-m-2 p-2 font-extrabold text-primary-deep underline underline-offset-4">
          로그인
        </Link>
      </p>
    </AuthShell>
  )
}
