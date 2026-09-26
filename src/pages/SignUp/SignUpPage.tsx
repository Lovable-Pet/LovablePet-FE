import { useState } from 'react'
import { PawPrint } from 'lucide-react'
import { Layout } from '../../components/Layout/Layout'
import { Button } from '../../components/Button/Button'
import { Field } from '../../components/Field/Field'

export function SignUpPage() {
  const [agreed, setAgreed] = useState(false)

  return (
    <Layout
      footer={
        <div className="flex justify-center gap-1 py-4 text-[14px]">
          <span className="text-base-600">이미 계정이 있나요?</span>
          <button type="button" className="font-semibold text-primary-500">
            로그인
          </button>
        </div>
      }
    >
      <div className="flex flex-1 flex-col items-center px-6 pt-16">
        <div className="flex size-[72px] items-center justify-center rounded-full bg-primary-50">
          <PawPrint className="size-8 text-primary-500" />
        </div>
        <h1 className="mt-6 font-[Sora] text-[24px] font-bold text-base-950">LovablePet</h1>
        <p className="mt-2 text-center text-[14px] text-base-500">
          유기동물과 가족을 연결하는 매칭 서비스
        </p>

        <form className="mt-10 flex w-full flex-col gap-4">
          <Field label="이메일" required type="email" placeholder="you@example.com" />
          <Field label="비밀번호" required type="password" placeholder="비밀번호 입력" />
          <Field label="비밀번호 확인" required type="password" placeholder="비밀번호 재입력" />

          <label className="flex items-center gap-2 text-[13px] text-base-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="size-[18px] rounded border-base-300"
            />
            서비스 이용약관 및 개인정보처리방침에 동의합니다
          </label>

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={!agreed}>
            가입하기
          </Button>
        </form>
      </div>
    </Layout>
  )
}
