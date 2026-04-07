import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
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
import { SettingsScreen } from './components/screens/SettingsScreen'
import { NotesExplorerScreen } from './components/screens/NotesExplorerScreen'
import { BudgetScreen } from './components/screens/BudgetScreen'
import { LayeringCombosScreen } from './components/screens/LayeringCombosScreen'
import { SeasonalRotationScreen } from './components/screens/SeasonalRotationScreen'
import { CustomListsScreen, ListDetailScreen } from './components/screens/CustomListsScreen'
import { AchievementsScreen } from './components/screens/AchievementsScreen'
import { TimelineScreen } from './components/screens/TimelineScreen'
import { StatsScreen } from './components/screens/StatsScreen'
import { FragranceOfDayScreen } from './components/screens/FragranceOfDayScreen'
import { ImportScreen } from './components/screens/ImportScreen'
import { WearCalendarScreen } from './components/screens/WearCalendarScreen'
import { SmartRecsScreen } from './components/screens/SmartRecsScreen'
import { ProfileCardScreen } from './components/screens/ProfileCardScreen'
import { MoodPickerScreen } from './components/screens/MoodPickerScreen'
import { JournalScreen } from './components/screens/JournalScreen'
import { QuickRateScreen } from './components/screens/QuickRateScreen'

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
      <ThemeProvider>
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
                path="/settings"
                element={
                  <AppLayout title="SETTINGS" showBack>
                    <SettingsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/notes"
                element={
                  <AppLayout title="NOTES" showBack>
                    <NotesExplorerScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/budget"
                element={
                  <AppLayout title="BUDGET" showBack>
                    <BudgetScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/combos"
                element={
                  <AppLayout title="COMBOS" showBack>
                    <LayeringCombosScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/rotation"
                element={
                  <AppLayout title="ROTATION" showBack>
                    <SeasonalRotationScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/lists"
                element={
                  <AppLayout title="MY LISTS" showBack>
                    <CustomListsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/lists/:id"
                element={
                  <AppLayout title="LIST" showBack>
                    <ListDetailScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/achievements"
                element={
                  <AppLayout title="ACHIEVEMENTS" showBack>
                    <AchievementsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/timeline"
                element={
                  <AppLayout title="TIMELINE" showBack>
                    <TimelineScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/stats"
                element={
                  <AppLayout title="STATS" showBack>
                    <StatsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/daily"
                element={
                  <AppLayout title="DAILY PICK" showBack>
                    <FragranceOfDayScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/import"
                element={
                  <AppLayout title="IMPORT" showBack>
                    <ImportScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/calendar"
                element={
                  <AppLayout title="WEAR CALENDAR" showBack>
                    <WearCalendarScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/smart-recs"
                element={
                  <AppLayout title="FOR YOU" showBack>
                    <SmartRecsScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/profile-card"
                element={
                  <AppLayout title="PROFILE CARD" showBack>
                    <ProfileCardScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/mood"
                element={
                  <AppLayout title="MOOD PICKER" showBack>
                    <MoodPickerScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/journal"
                element={
                  <AppLayout title="JOURNAL" showBack>
                    <JournalScreen />
                  </AppLayout>
                }
              />
              <Route
                path="/quick-rate"
                element={
                  <AppLayout title="QUICK RATE" showBack>
                    <QuickRateScreen />
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
      </ThemeProvider>
    </ErrorBoundary>
  )
}
