import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { TopAppBar } from './components/layout/TopAppBar'
import { BottomNav } from './components/layout/BottomNav'
import { HomeScreen } from './components/screens/HomeScreen'
import { CollectionScreen } from './components/screens/CollectionScreen'
import { FragranceDetailScreen } from './components/screens/FragranceDetailScreen'
import { LayeringLabScreen } from './components/screens/LayeringLabScreen'
import { ExploreScreen } from './components/screens/ExploreScreen'
import { ProfileScreen } from './components/screens/ProfileScreen'

function AppLayout({ children, showBack, title }: { children: React.ReactNode; showBack?: boolean; title?: string }) {
  return (
    <>
      <TopAppBar showBack={showBack} title={title} showSearch={showBack} />
      {children}
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <div className="max-w-[430px] mx-auto min-h-screen relative bg-background">
            <Routes>
              <Route
                path="/"
                element={
                  <AppLayout>
                    <HomeScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/collection"
                element={
                  <AppLayout title="SCENTFOLIO" showBack={false}>
                    <CollectionScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/fragrance/:id"
                element={
                  <AppLayout showBack title="SCENT PROFILE">
                    <FragranceDetailScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/layering-lab"
                element={
                  <AppLayout title="Layering Lab" showBack>
                    <LayeringLabScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/explore"
                element={
                  <AppLayout title="SCENTFOLIO">
                    <ExploreScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/profile"
                element={
                  <AppLayout title="SCENTFOLIO">
                    <ProfileScreen />
                  </AppLayout>
                }
              />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}
