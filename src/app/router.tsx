import { createBrowserRouter } from 'react-router'
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
      // AR 은 3D 라이브러리(model-viewer, three.js)가 커서 이 화면에 들어올 때 불러온다
      {
        path: 'pets/:petId/ar',
        lazy: () => import('../pages/ArPage').then((m) => ({ Component: m.ArPage })),
        // 주소로 바로 들어와 화면 코드를 받는 동안
        HydrateFallback: () => <div className="min-h-dvh bg-canvas" aria-busy="true" />,
      },
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
