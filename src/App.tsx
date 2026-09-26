import { useState } from 'react'
import { SignUpPage } from './pages/SignUp/SignUpPage'
import { OnboardingPage } from './pages/Onboarding/OnboardingPage'
import { PetListPage } from './pages/PetList/PetListPage'
import { PetDetailPage } from './pages/PetDetail/PetDetailPage'
import { ARPreviewPage } from './pages/ARPreview/ARPreviewPage'

const pageKeys = ['SignUp', 'Onboarding', 'PetList', 'PetDetail', 'ARPreview'] as const
type PageKey = (typeof pageKeys)[number]

function App() {
  const [page, setPage] = useState<PageKey>('SignUp')

  return (
    <div>
      <div className="flex justify-center gap-2 border-b border-base-200 bg-white py-2">
        {pageKeys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPage(key)}
            className={`rounded px-2 py-1 text-[12px] ${
              page === key ? 'bg-primary-500 text-white' : 'text-base-500'
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {page === 'SignUp' && <SignUpPage />}
      {page === 'Onboarding' && <OnboardingPage />}
      {page === 'PetList' && <PetListPage />}
      {page === 'PetDetail' && <PetDetailPage onViewAR={() => setPage('ARPreview')} />}
      {page === 'ARPreview' && <ARPreviewPage onBack={() => setPage('PetDetail')} />}
    </div>
  )
}

export default App
