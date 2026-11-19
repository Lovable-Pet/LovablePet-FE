import { Link } from 'react-router'
import { buttonClass } from '../components/Button/buttonClass'
import { StateView } from '../components/StateView/StateView'

// 없는 주소이거나 화면을 그리다 오류가 났을 때
export function NotFoundPage() {
  return (
    <div className="app-column flex items-center justify-center">
      <StateView
        character="confused"
        title="화면을 찾을 수 없어요"
        description="주소가 바뀌었거나 없는 화면이에요."
        action={
          <Link to="/" replace className={buttonClass()}>
            유기견 둘러보기
          </Link>
        }
      />
    </div>
  )
}
