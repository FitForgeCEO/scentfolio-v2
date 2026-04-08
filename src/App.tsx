import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import { TopAppBar } from './components/layout/TopAppBar'
import { BottomNav } from './components/layout/BottomNav'
import { InstallBanner } from './components/ui/InstallBanner'
import { ScreenSkeleton, GridSkeleton } from './components/ui/ScreenSkeleton'

// ── Core tab screens (eagerly loaded — always needed) ──────────────
import { HomeScreen } from './components/screens/HomeScreen'
import { CollectionScreen } from './components/screens/CollectionScreen'
import { ExploreScreen } from './components/screens/ExploreScreen'
import { ProfileScreen } from './components/screens/ProfileScreen'

// ── Lazy-loaded screens ────────────────────────────────────────────
// Each chunk is only fetched when the user navigates to that route.
const FragranceDetailScreen = lazy(() => import('./components/screens/FragranceDetailScreen').then(m => ({ default: m.FragranceDetailScreen })))
const LayeringLabScreen = lazy(() => import('./components/screens/LayeringLabScreen').then(m => ({ default: m.LayeringLabScreen })))
const WearHistoryScreen = lazy(() => import('./components/screens/WearHistoryScreen').then(m => ({ default: m.WearHistoryScreen })))
const ScentBoardsScreen = lazy(() => import('./components/screens/ScentBoardsScreen').then(m => ({ default: m.ScentBoardsScreen })))
const BoardDetailScreen = lazy(() => import('./components/screens/ScentBoardsScreen').then(m => ({ default: m.BoardDetailScreen })))
const SavedStacksScreen = lazy(() => import('./components/screens/SavedStacksScreen').then(m => ({ default: m.SavedStacksScreen })))
const SearchScreen = lazy(() => import('./components/screens/SearchScreen').then(m => ({ default: m.SearchScreen })))
const DecantsScreen = lazy(() => import('./components/screens/DecantsScreen').then(m => ({ default: m.DecantsScreen })))
const WishlistScreen = lazy(() => import('./components/screens/WishlistScreen').then(m => ({ default: m.WishlistScreen })))
const InsightsScreen = lazy(() => import('./components/screens/InsightsScreen').then(m => ({ default: m.InsightsScreen })))
const CompareScreen = lazy(() => import('./components/screens/CompareScreen').then(m => ({ default: m.CompareScreen })))
const RecommendScreen = lazy(() => import('./components/screens/RecommendScreen').then(m => ({ default: m.RecommendScreen })))
const SettingsScreen = lazy(() => import('./components/screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })))
const NotesExplorerScreen = lazy(() => import('./components/screens/NotesExplorerScreen').then(m => ({ default: m.NotesExplorerScreen })))
const BudgetScreen = lazy(() => import('./components/screens/BudgetScreen').then(m => ({ default: m.BudgetScreen })))
const LayeringCombosScreen = lazy(() => import('./components/screens/LayeringCombosScreen').then(m => ({ default: m.LayeringCombosScreen })))
const SeasonalRotationScreen = lazy(() => import('./components/screens/SeasonalRotationScreen').then(m => ({ default: m.SeasonalRotationScreen })))
const CustomListsScreen = lazy(() => import('./components/screens/CustomListsScreen').then(m => ({ default: m.CustomListsScreen })))
const ListDetailScreen = lazy(() => import('./components/screens/CustomListsScreen').then(m => ({ default: m.ListDetailScreen })))
const AchievementsScreen = lazy(() => import('./components/screens/AchievementsScreen').then(m => ({ default: m.AchievementsScreen })))
const TimelineScreen = lazy(() => import('./components/screens/TimelineScreen').then(m => ({ default: m.TimelineScreen })))
const StatsScreen = lazy(() => import('./components/screens/StatsScreen').then(m => ({ default: m.StatsScreen })))
const FragranceOfDayScreen = lazy(() => import('./components/screens/FragranceOfDayScreen').then(m => ({ default: m.FragranceOfDayScreen })))
const ImportScreen = lazy(() => import('./components/screens/ImportScreen').then(m => ({ default: m.ImportScreen })))
const WearCalendarScreen = lazy(() => import('./components/screens/WearCalendarScreen').then(m => ({ default: m.WearCalendarScreen })))
const SmartRecsScreen = lazy(() => import('./components/screens/SmartRecsScreen').then(m => ({ default: m.SmartRecsScreen })))
const ProfileCardScreen = lazy(() => import('./components/screens/ProfileCardScreen').then(m => ({ default: m.ProfileCardScreen })))
const MoodPickerScreen = lazy(() => import('./components/screens/MoodPickerScreen').then(m => ({ default: m.MoodPickerScreen })))
const JournalScreen = lazy(() => import('./components/screens/JournalScreen').then(m => ({ default: m.JournalScreen })))
const QuickRateScreen = lazy(() => import('./components/screens/QuickRateScreen').then(m => ({ default: m.QuickRateScreen })))
const CommunityFeedScreen = lazy(() => import('./components/screens/CommunityFeedScreen').then(m => ({ default: m.CommunityFeedScreen })))
const LeaderboardScreen = lazy(() => import('./components/screens/LeaderboardScreen').then(m => ({ default: m.LeaderboardScreen })))
const DNAProfileScreen = lazy(() => import('./components/screens/DNAProfileScreen').then(m => ({ default: m.DNAProfileScreen })))
const LayeringSuggestionsScreen = lazy(() => import('./components/screens/LayeringSuggestionsScreen').then(m => ({ default: m.LayeringSuggestionsScreen })))
const PriceTrackerScreen = lazy(() => import('./components/screens/PriceTrackerScreen').then(m => ({ default: m.PriceTrackerScreen })))
const SeasonalSuggestScreen = lazy(() => import('./components/screens/SeasonalSuggestScreen').then(m => ({ default: m.SeasonalSuggestScreen })))
const DuplicateDetectorScreen = lazy(() => import('./components/screens/DuplicateDetectorScreen').then(m => ({ default: m.DuplicateDetectorScreen })))
const CollectionShareScreen = lazy(() => import('./components/screens/CollectionShareScreen').then(m => ({ default: m.CollectionShareScreen })))
const PublicProfileScreen = lazy(() => import('./components/screens/PublicProfileScreen').then(m => ({ default: m.PublicProfileScreen })))
const MonthInFragranceScreen = lazy(() => import('./components/screens/MonthInFragranceScreen').then(m => ({ default: m.MonthInFragranceScreen })))
const YearInFragranceScreen = lazy(() => import('./components/screens/YearInFragranceScreen').then(m => ({ default: m.YearInFragranceScreen })))
const SmartCollectionsScreen = lazy(() => import('./components/screens/SmartCollectionsScreen').then(m => ({ default: m.SmartCollectionsScreen })))
const WeatherMatchScreen = lazy(() => import('./components/screens/WeatherMatchScreen').then(m => ({ default: m.WeatherMatchScreen })))
const CollectionValueScreen = lazy(() => import('./components/screens/CollectionValueScreen').then(m => ({ default: m.CollectionValueScreen })))
const BadgesScreen = lazy(() => import('./components/screens/BadgesScreen').then(m => ({ default: m.BadgesScreen })))

// ── Layout wrapper ─────────────────────────────────────────────────
function AppLayout({ children, showBack, title }: { children: React.ReactNode; showBack?: boolean; title?: string }) {
  return (
    <>
      <TopAppBar showBack={showBack} title={title} showSearch={showBack} />
      {children}
      <BottomNav />
    </>
  )
}

// ── Suspense wrapper with page-enter animation ─────────────────────
function LazyScreen({ children, grid }: { children: React.ReactNode; grid?: boolean }) {
  return (
    <Suspense fallback={grid ? <GridSkeleton /> : <ScreenSkeleton />}>
      <div className="animate-page-enter">
        {children}
      </div>
    </Suspense>
  )
}

// ── App ────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <div className="max-w-[430px] mx-auto min-h-screen relative bg-background">
            <Routes>
              {/* ── Core tabs (eager) ── */}
              <Route path="/" element={<AppLayout><HomeScreen /></AppLayout>} />
              <Route path="/collection" element={<AppLayout title="SCENTFOLIO" showBack={false}><CollectionScreen /></AppLayout>} />
              <Route path="/explore" element={<AppLayout title="SCENTFOLIO"><ExploreScreen /></AppLayout>} />
              <Route path="/profile" element={<AppLayout title="SCENTFOLIO"><ProfileScreen /></AppLayout>} />

              {/* ── Fragrance detail ── */}
              <Route path="/fragrance/:id" element={<AppLayout showBack title="SCENT PROFILE"><LazyScreen><FragranceDetailScreen /></LazyScreen></AppLayout>} />

              {/* ── Collection tools ── */}
              <Route path="/wear-history" element={<AppLayout title="WEAR HISTORY" showBack><LazyScreen><WearHistoryScreen /></LazyScreen></AppLayout>} />
              <Route path="/boards" element={<AppLayout title="SCENT BOARDS" showBack><LazyScreen><ScentBoardsScreen /></LazyScreen></AppLayout>} />
              <Route path="/boards/:id" element={<AppLayout title="BOARD" showBack><LazyScreen><BoardDetailScreen /></LazyScreen></AppLayout>} />
              <Route path="/saved-stacks" element={<AppLayout title="SAVED STACKS" showBack><LazyScreen><SavedStacksScreen /></LazyScreen></AppLayout>} />
              <Route path="/wishlist" element={<AppLayout title="WANT TO TRY" showBack><LazyScreen><WishlistScreen /></LazyScreen></AppLayout>} />
              <Route path="/compare" element={<AppLayout title="COMPARE" showBack><LazyScreen><CompareScreen /></LazyScreen></AppLayout>} />
              <Route path="/decants" element={<AppLayout title="DECANTS" showBack><LazyScreen><DecantsScreen /></LazyScreen></AppLayout>} />
              <Route path="/budget" element={<AppLayout title="BUDGET" showBack><LazyScreen><BudgetScreen /></LazyScreen></AppLayout>} />
              <Route path="/import" element={<AppLayout title="IMPORT" showBack><LazyScreen><ImportScreen /></LazyScreen></AppLayout>} />
              <Route path="/prices" element={<AppLayout title="PRICES" showBack><LazyScreen><PriceTrackerScreen /></LazyScreen></AppLayout>} />
              <Route path="/duplicates" element={<AppLayout title="DUPLICATES" showBack><LazyScreen><DuplicateDetectorScreen /></LazyScreen></AppLayout>} />
              <Route path="/rotation" element={<AppLayout title="ROTATION" showBack><LazyScreen><SeasonalRotationScreen /></LazyScreen></AppLayout>} />
              <Route path="/combos" element={<AppLayout title="COMBOS" showBack><LazyScreen><LayeringCombosScreen /></LazyScreen></AppLayout>} />
              <Route path="/lists" element={<AppLayout title="MY LISTS" showBack><LazyScreen><CustomListsScreen /></LazyScreen></AppLayout>} />
              <Route path="/lists/:id" element={<AppLayout title="LIST" showBack><LazyScreen><ListDetailScreen /></LazyScreen></AppLayout>} />

              {/* ── Discovery & explore ── */}
              <Route path="/search" element={<AppLayout title="SEARCH" showBack><LazyScreen grid><SearchScreen /></LazyScreen></AppLayout>} />
              <Route path="/notes" element={<AppLayout title="NOTES" showBack><LazyScreen><NotesExplorerScreen /></LazyScreen></AppLayout>} />
              <Route path="/smart-recs" element={<AppLayout title="FOR YOU" showBack><LazyScreen><SmartRecsScreen /></LazyScreen></AppLayout>} />
              <Route path="/seasonal" element={<AppLayout title="SEASONAL" showBack><LazyScreen><SeasonalSuggestScreen /></LazyScreen></AppLayout>} />
              <Route path="/layering" element={<AppLayout title="LAYERING" showBack><LazyScreen><LayeringSuggestionsScreen /></LazyScreen></AppLayout>} />
              <Route path="/layering-lab" element={<AppLayout title="Layering Lab" showBack><LazyScreen><LayeringLabScreen /></LazyScreen></AppLayout>} />

              {/* ── Daily & wear ── */}
              <Route path="/daily" element={<AppLayout title="DAILY PICK" showBack><LazyScreen><FragranceOfDayScreen /></LazyScreen></AppLayout>} />
              <Route path="/recommend" element={<AppLayout title="TODAY'S PICK" showBack><LazyScreen><RecommendScreen /></LazyScreen></AppLayout>} />
              <Route path="/mood" element={<AppLayout title="MOOD PICKER" showBack><LazyScreen><MoodPickerScreen /></LazyScreen></AppLayout>} />
              <Route path="/calendar" element={<AppLayout title="WEAR CALENDAR" showBack><LazyScreen><WearCalendarScreen /></LazyScreen></AppLayout>} />
              <Route path="/quick-rate" element={<AppLayout title="QUICK RATE" showBack><LazyScreen><QuickRateScreen /></LazyScreen></AppLayout>} />
              <Route path="/journal" element={<AppLayout title="JOURNAL" showBack><LazyScreen><JournalScreen /></LazyScreen></AppLayout>} />

              {/* ── Community ── */}
              <Route path="/community" element={<AppLayout title="COMMUNITY" showBack><LazyScreen><CommunityFeedScreen /></LazyScreen></AppLayout>} />
              <Route path="/leaderboard" element={<AppLayout title="TRENDING" showBack><LazyScreen><LeaderboardScreen /></LazyScreen></AppLayout>} />

              {/* ── Profile features ── */}
              <Route path="/dna" element={<AppLayout title="YOUR DNA" showBack><LazyScreen><DNAProfileScreen /></LazyScreen></AppLayout>} />
              <Route path="/profile-card" element={<AppLayout title="PROFILE CARD" showBack><LazyScreen><ProfileCardScreen /></LazyScreen></AppLayout>} />
              <Route path="/achievements" element={<AppLayout title="ACHIEVEMENTS" showBack><LazyScreen><AchievementsScreen /></LazyScreen></AppLayout>} />
              <Route path="/stats" element={<AppLayout title="STATS" showBack><LazyScreen><StatsScreen /></LazyScreen></AppLayout>} />
              <Route path="/timeline" element={<AppLayout title="TIMELINE" showBack><LazyScreen><TimelineScreen /></LazyScreen></AppLayout>} />
              <Route path="/insights" element={<AppLayout title="INSIGHTS" showBack><LazyScreen><InsightsScreen /></LazyScreen></AppLayout>} />

              {/* ── Share & Social ── */}
              <Route path="/share-collection" element={<AppLayout title="SHARE" showBack><LazyScreen><CollectionShareScreen /></LazyScreen></AppLayout>} />
              <Route path="/month-review" element={<AppLayout title="MONTH REVIEW" showBack><LazyScreen><MonthInFragranceScreen /></LazyScreen></AppLayout>} />
              <Route path="/year-wrapped" element={<AppLayout title="YEAR WRAPPED" showBack><LazyScreen><YearInFragranceScreen /></LazyScreen></AppLayout>} />
              <Route path="/u/:userId" element={<AppLayout title="PROFILE" showBack><LazyScreen><PublicProfileScreen /></LazyScreen></AppLayout>} />
              <Route path="/u/:userId/collection" element={<AppLayout title="COLLECTION" showBack><LazyScreen><PublicProfileScreen /></LazyScreen></AppLayout>} />

              {/* ── Analytics & Engagement ── */}
              <Route path="/smart-collections" element={<AppLayout title="SMART COLLECTIONS" showBack><LazyScreen><SmartCollectionsScreen /></LazyScreen></AppLayout>} />
              <Route path="/weather" element={<AppLayout title="WEATHER MATCH" showBack><LazyScreen><WeatherMatchScreen /></LazyScreen></AppLayout>} />
              <Route path="/value" element={<AppLayout title="VALUE TRACKER" showBack><LazyScreen><CollectionValueScreen /></LazyScreen></AppLayout>} />
              <Route path="/badges" element={<AppLayout title="BADGES" showBack><LazyScreen><BadgesScreen /></LazyScreen></AppLayout>} />

              {/* ── Settings ── */}
              <Route path="/settings" element={<AppLayout title="SETTINGS" showBack><LazyScreen><SettingsScreen /></LazyScreen></AppLayout>} />
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
