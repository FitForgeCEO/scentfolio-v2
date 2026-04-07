import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { TopAppBar } from './components/layout/TopAppBar'
import { BottomNav } from './components/layout/BottomNav'
import { HomeScreen } from './components/screens/HomeScreen'
import { CollectionScreen } from './components/screens/CollectionScreen'
import { FragranceDetailScreen } from './components/screens/FragranceDetailScreen'
import { LayeringLabScreen } from './components/screens/LayeringLabScreen'
import { ExploreScreen } from './components/screens/ExploreScreen'
import { ProfileScreen } from './components/screens/ProfileScreen'
import { WearHistoryScreen } from './components/screens/WearHistoryScreen'
import { ScentBoardsScreen, BoardDetailScreen } from './components/screens/ScentBoardsScreen'
import { SavedStacksScreen } from './components/screens/SavedStacksScreen'
import { SearchScreen } from './components/screens/SearchScreen'
import { InstallBanner } from './components/ui/InstallBanner'
import { DecantsScreen } from './components/screens/DecantsScreen'
import { WishlistScreen } from './components/screens/WishlistScreen'
import { InsightsScreen } from './components/screens/InsightsScreen'
import { CompareScreen } from './components/screens/CompareScreen'
import { RecommendScreen } from './components/screens/RecommendScreen'

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
        <ToastProvider>
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
                path="/wear-history"
                element={
                  <AppLayout title="WEAR HISTORY" showBack>
                    <WearHistoryScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/boards"
                element={
                  <AppLayout title="SCENT BOARDS" showBack>
                    <ScentBoardsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/boards/:id"
                element={
                  <AppLayout title="BOARD" showBack>
                    <BoardDetailScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/saved-stacks"
                element={
                  <AppLayout title="SAVED STACKS" showBack>
                    <SavedStacksScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/search"
                element={
                  <AppLayout title="SEARCH" showBack>
                    <SearchScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/wishlist"
                element={
                  <AppLayout title="WANT TO TRY" showBack>
                    <WishlistScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/insights"
                element={
                  <AppLayout title="INSIGHTS" showBack>
                    <InsightsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/compare"
                element={
                  <AppLayout title="COMPARE" showBack>
                    <CompareScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/recommend"
                element={
                  <AppLayout title="TODAY'S PICK" showBack>
                    <RecommendScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/decants"
                element={
                  <AppLayout title="DECANTS" showBack>
                    <DecantsScreen />
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
            <InstallBanner />
          </div>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
