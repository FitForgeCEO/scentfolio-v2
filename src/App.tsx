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
const ScentQuizScreen = lazy(() => import('./components/screens/ScentQuizScreen').then(m => ({ default: m.ScentQuizScreen })))
const CollectionInsightsScreen = lazy(() => import('./components/screens/CollectionInsightsScreen').then(m => ({ default: m.CollectionInsightsScreen })))
const WearPredictionsScreen = lazy(() => import('./components/screens/WearPredictionsScreen').then(m => ({ default: m.WearPredictionsScreen })))
const CollectionHealthScreen = lazy(() => import('./components/screens/CollectionHealthScreen').then(m => ({ default: m.CollectionHealthScreen })))
const DiscoverScreen = lazy(() => import('./components/screens/DiscoverScreen').then(m => ({ default: m.DiscoverScreen })))
const DataManagementScreen = lazy(() => import('./components/screens/DataManagementScreen').then(m => ({ default: m.DataManagementScreen })))
const ActivityFeedScreen = lazy(() => import('./components/screens/ActivityFeedScreen').then(m => ({ default: m.ActivityFeedScreen })))
const TagManagerScreen = lazy(() => import('./components/screens/TagManagerScreen').then(m => ({ default: m.TagManagerScreen })))
const WearHeatmapScreen = lazy(() => import('./components/screens/WearHeatmapScreen').then(m => ({ default: m.WearHeatmapScreen })))
const SocialFeedScreen = lazy(() => import('./components/screens/SocialFeedScreen').then(m => ({ default: m.SocialFeedScreen })))
const FollowListScreen = lazy(() => import('./components/screens/FollowListScreen').then(m => ({ default: m.FollowListScreen })))
const ExplorePeopleScreen = lazy(() => import('./components/screens/ExplorePeopleScreen').then(m => ({ default: m.ExplorePeopleScreen })))
const BlockedUsersScreen = lazy(() => import('./components/screens/BlockedUsersScreen').then(m => ({ default: m.BlockedUsersScreen })))
const ChallengesScreen = lazy(() => import('./components/screens/ChallengesScreen').then(m => ({ default: m.ChallengesScreen })))
const BrandExplorerScreen = lazy(() => import('./components/screens/BrandExplorerScreen').then(m => ({ default: m.BrandExplorerScreen })))
const FamilyExplorerScreen = lazy(() => import('./components/screens/FamilyExplorerScreen').then(m => ({ default: m.FamilyExplorerScreen })))
const TopShelfScreen = lazy(() => import('./components/screens/TopShelfScreen').then(m => ({ default: m.TopShelfScreen })))
const GiftRecommenderScreen = lazy(() => import('./components/screens/GiftRecommenderScreen').then(m => ({ default: m.GiftRecommenderScreen })))
const DupeFinderScreen = lazy(() => import('./components/screens/DupeFinderScreen').then(m => ({ default: m.DupeFinderScreen })))
const MilestonesScreen = lazy(() => import('./components/screens/MilestonesScreen').then(m => ({ default: m.MilestonesScreen })))
const BlindBuyScreen = lazy(() => import('./components/screens/BlindBuyScreen').then(m => ({ default: m.BlindBuyScreen })))
const OnboardingFlowScreen = lazy(() => import('./components/screens/OnboardingFlowScreen').then(m => ({ default: m.OnboardingFlowScreen })))

// ── Layout wrapper ─────────────────────────────────────────────────
function AppLayout({ children, showBack, title }: { children: React.ReactNode; showBack?: boolean; title?: string }) {
  return (
    <>
      <TopAppBar showBack={showBack} title={title} showSearch={showBack} />
      <div id="main-content">
        {children}
      </div>
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
              {/* ── Onboarding (no AppLayout — full-screen flow) ── */}
              <Route path="/onboarding" element={<LazyScreen><OnboardingFlowScreen /></LazyScreen>} />

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

              {/* ── Brand & Family Explorer ── */}
              <Route path="/brands" element={<AppLayout title="BRANDS" showBack><LazyScreen><BrandExplorerScreen /></LazyScreen></AppLayout>} />
              <Route path="/families" element={<AppLayout title="NOTE FAMILIES" showBack><LazyScreen><FamilyExplorerScreen /></LazyScreen></AppLayout>} />
              <Route path="/top-shelf" element={<AppLayout title="TOP SHELF" showBack><LazyScreen><TopShelfScreen /></LazyScreen></AppLayout>} />
              <Route path="/gift-finder" element={<AppLayout title="GIFT FINDER" showBack><LazyScreen><GiftRecommenderScreen /></LazyScreen></AppLayout>} />
              <Route path="/dupes" element={<AppLayout title="DUPE FINDER" showBack><LazyScreen><DupeFinderScreen /></LazyScreen></AppLayout>} />
              <Route path="/milestones" element={<AppLayout title="MILESTONES" showBack><LazyScreen><MilestonesScreen /></LazyScreen></AppLayout>} />
              <Route path="/blind-buys" element={<AppLayout title="BLIND BUYS" showBack><LazyScreen><BlindBuyScreen /></LazyScreen></AppLayout>} />

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
              <Route path="/u/:userId/followers" element={<AppLayout title="FOLLOWERS" showBack><LazyScreen><FollowListScreen /></LazyScreen></AppLayout>} />
              <Route path="/u/:userId/following" element={<AppLayout title="FOLLOWING" showBack><LazyScreen><FollowListScreen /></LazyScreen></AppLayout>} />
              <Route path="/feed" element={<AppLayout title="FEED" showBack><LazyScreen><SocialFeedScreen /></LazyScreen></AppLayout>} />
              <Route path="/people" element={<AppLayout title="EXPLORE PEOPLE" showBack><LazyScreen><ExplorePeopleScreen /></LazyScreen></AppLayout>} />
              <Route path="/blocked" element={<AppLayout title="BLOCKED USERS" showBack><LazyScreen><BlockedUsersScreen /></LazyScreen></AppLayout>} />
              <Route path="/challenges" element={<AppLayout title="CHALLENGES" showBack><LazyScreen><ChallengesScreen /></LazyScreen></AppLayout>} />

              {/* ── Analytics & Engagement ── */}
              <Route path="/smart-collections" element={<AppLayout title="SMART COLLECTIONS" showBack><LazyScreen><SmartCollectionsScreen /></LazyScreen></AppLayout>} />
              <Route path="/weather" element={<AppLayout title="WEATHER MATCH" showBack><LazyScreen><WeatherMatchScreen /></LazyScreen></AppLayout>} />
              <Route path="/value" element={<AppLayout title="VALUE TRACKER" showBack><LazyScreen><CollectionValueScreen /></LazyScreen></AppLayout>} />
              <Route path="/badges" element={<AppLayout title="BADGES" showBack><LazyScreen><BadgesScreen /></LazyScreen></AppLayout>} />

              {/* ── Data Quality & Personalization ── */}
              <Route path="/scent-quiz" element={<AppLayout title="SCENT QUIZ" showBack><LazyScreen><ScentQuizScreen /></LazyScreen></AppLayout>} />
              <Route path="/collection-insights" element={<AppLayout title="INSIGHTS" showBack><LazyScreen><CollectionInsightsScreen /></LazyScreen></AppLayout>} />
              <Route path="/wear-predictions" element={<AppLayout title="TODAY'S PICKS" showBack><LazyScreen><WearPredictionsScreen /></LazyScreen></AppLayout>} />
              <Route path="/collection-health" element={<AppLayout title="HEALTH SCORE" showBack><LazyScreen><CollectionHealthScreen /></LazyScreen></AppLayout>} />
              <Route path="/discover" element={<AppLayout title="DISCOVER" showBack><LazyScreen><DiscoverScreen /></LazyScreen></AppLayout>} />

              {/* ── Data & Export ── */}
              <Route path="/data" element={<AppLayout title="DATA & EXPORT" showBack><LazyScreen><DataManagementScreen /></LazyScreen></AppLayout>} />

              {/* ── Notifications & Activity ── */}
              <Route path="/activity" element={<AppLayout title="ACTIVITY" showBack><LazyScreen><ActivityFeedScreen /></LazyScreen></AppLayout>} />

              {/* ── Tags ── */}
              <Route path="/tags" element={<AppLayout title="MY TAGS" showBack><LazyScreen><TagManagerScreen /></LazyScreen></AppLayout>} />

              {/* ── Wear Heatmap ── */}
              <Route path="/heatmap" element={<AppLayout title="WEAR HEATMAP" showBack><LazyScreen><WearHeatmapScreen /></LazyScreen></AppLayout>} />

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
