import { RouterProvider } from 'react-router'
import { AppProviders } from './app/AppProviders'
import { router } from './app/router'

function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  )
}

export default App
