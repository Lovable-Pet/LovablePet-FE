import { createBrowserRouter } from 'react-router'
import { ArPendingPage } from '../pages/ArPendingPage'
import { BrowsePage } from '../pages/BrowsePage'
import { FavoritesPage } from '../pages/FavoritesPage'
import { KakaoCallbackPage } from '../pages/KakaoCallbackPage'
import { LoginPage } from '../pages/LoginPage'
import { MePage } from '../pages/MePage'
import { PetDetailPage } from '../pages/PetDetailPage'
import { SignUpPage } from '../pages/SignUpPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { AdminAttemptsPage } from '../pages/admin/AdminAttemptsPage'
import { AdminCreatePage } from '../pages/admin/AdminCreatePage'
import { AdminPetsPage } from '../pages/admin/AdminPetsPage'
import { RequireAdmin } from './guards/RequireAdmin'
import { RequireAuth } from './guards/RequireAuth'
import { AdminLayout } from './layouts/AdminLayout'
import { RootLayout } from './layouts/RootLayout'
import { TabLayout } from './layouts/TabLayout'

export const router = createBrowserRouter([
  {
    // 스크롤 복원·키보드 높이 (모든 화면 공통)
    element: <RootLayout />,
    children: [
      {
        element: <TabLayout />,
        errorElement: <NotFoundPage />,
        children: [
          { index: true, element: <BrowsePage /> },
          {
            path: 'favorites',
            element: (
              <RequireAuth>
                <FavoritesPage />
              </RequireAuth>
            ),
          },
          { path: 'me', element: <MePage /> },
        ],
      },
      { path: 'pets/:petId', element: <PetDetailPage /> },
      // AR(6단계)은 대기 중. 상세의 '우리 집에 놓아 보기'를 누르면 안내만 보인다
      { path: 'pets/:petId/ar', element: <ArPendingPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignUpPage /> },
      { path: 'oauth/kakao', element: <KakaoCallbackPage /> },
      {
        path: 'admin',
        element: (
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        ),
        children: [
          { index: true, element: <AdminPetsPage /> },
          { path: 'pets/:petId/model', element: <AdminCreatePage /> },
          { path: 'models', element: <AdminAttemptsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
