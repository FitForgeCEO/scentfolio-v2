import { useState, useEffect } from 'react'
import { Icon } from '../ui/Icon'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { getLevelTitle } from '@/lib/xp'

interface AchievementDef {
  id: string
  icon: string
  name: string
  description: string
  category: 'collection' | 'wearing' | 'social' | 'exploration'
  check: (stats: UserStats) => boolean
  xpReward: number
}

interface UserStats {
  owned: number
  wishlist: number
  wears: number
  reviews: number
  boards: number
  streak: number
  uniqueBrands: number
  uniqueFamilies: number
  combos: number
  lists: number
  decants: number
  level: number
}

const ACHIEVEMENTS: AchievementDef[] = [
  // Collection
  { id: 'first_bottle', icon: 'water_drop', name: 'First Bottle', description: 'Add your first fragrance to collection', category: 'collection', check: (s) => s.owned >= 1, xpReward: 10 },
  { id: 'starting_shelf', icon: 'shelves', name: 'Starting Shelf', description: 'Own 5 fragrances', category: 'collection', check: (s) => s.owned >= 5, xpReward: 25 },
  { id: 'serious_collector', icon: 'inventory_2', name: 'Serious Collector', description: 'Own 10 fragrances', category: 'collection', check: (s) => s.owned >= 10, xpReward: 50 },
  { id: 'fragrance_vault', icon: 'lock', name: 'Fragrance Vault', description: 'Own 25 fragrances', category: 'collection', check: (s) => s.owned >= 25, xpReward: 100 },
  { id: 'perfume_palace', icon: 'castle', name: 'Perfume Palace', description: 'Own 50 fragrances', category: 'collection', check: (s) => s.owned >= 50, xpReward: 200 },
  { id: 'brand_explorer', icon: 'travel_explore', name: 'Brand Explorer', description: 'Collect from 5 different brands', category: 'collection', check: (s) => s.uniqueBrands >= 5, xpReward: 30 },
  { id: 'brand_connoisseur', icon: 'workspace_premium', name: 'Brand Connoisseur', description: 'Collect from 10 different brands', category: 'collection', check: (s) => s.uniqueBrands >= 10, xpReward: 75 },
  { id: 'nose_diversity', icon: 'spa', name: 'Diverse Nose', description: 'Own fragrances from 5 note families', category: 'collection', check: (s) => s.uniqueFamilies >= 5, xpReward: 40 },
  { id: 'decant_dabbler', icon: 'science', name: 'Decant Dabbler', description: 'Add your first decant', category: 'collection', check: (s) => s.decants >= 1, xpReward: 15 },

  // Wearing
  { id: 'first_wear', icon: 'checkroom', name: 'First Spritz', description: 'Log your first wear', category: 'wearing', check: (s) => s.wears >= 1, xpReward: 10 },
  { id: 'daily_ritual', icon: 'routine', name: 'Daily Ritual', description: 'Log 10 wears', category: 'wearing', check: (s) => s.wears >= 10, xpReward: 30 },
  { id: 'scent_devotee', icon: 'favorite', name: 'Scent Devotee', description: 'Log 50 wears', category: 'wearing', check: (s) => s.wears >= 50, xpReward: 75 },
  { id: 'perfume_addict', icon: 'local_fire_department', name: 'Fragrance Addict', description: 'Log 100 wears', category: 'wearing', check: (s) => s.wears >= 100, xpReward: 150 },
  { id: 'streak_starter', icon: 'bolt', name: 'Streak Starter', description: 'Reach a 3-day wear streak', category: 'wearing', check: (s) => s.streak >= 3, xpReward: 20 },
  { id: 'streak_warrior', icon: 'whatshot', name: 'Streak Warrior', description: 'Reach a 7-day wear streak', category: 'wearing', check: (s) => s.streak >= 7, xpReward: 50 },
  { id: 'streak_legend', icon: 'military_tech', name: 'Streak Legend', description: 'Reach a 30-day wear streak', category: 'wearing', check: (s) => s.streak >= 30, xpReward: 200 },

  // Social
  { id: 'first_review', icon: 'rate_review', name: 'First Critique', description: 'Write your first review', category: 'social', check: (s) => s.reviews >= 1, xpReward: 15 },
  { id: 'review_regular', icon: 'edit_note', name: 'Review Regular', description: 'Write 5 reviews', category: 'social', check: (s) => s.reviews >= 5, xpReward: 40 },
  { id: 'top_critic', icon: 'verified', name: 'Top Critic', description: 'Write 20 reviews', category: 'social', check: (s) => s.reviews >= 20, xpReward: 100 },
  { id: 'board_builder', icon: 'dashboard', name: 'Board Builder', description: 'Create your first scent board', category: 'social', check: (s) => s.boards >= 1, xpReward: 15 },
  { id: 'list_maker', icon: 'bookmarks', name: 'List Maker', description: 'Create a custom list', category: 'social', check: (s) => s.lists >= 1, xpReward: 10 },

  // Exploration
  { id: 'wishlist_dreamer', icon: 'auto_awesome', name: 'Wishlist Dreamer', description: 'Add 5 fragrances to your wishlist', category: 'exploration', check: (s) => s.wishlist >= 5, xpReward: 15 },
  { id: 'combo_creator', icon: 'layers', name: 'Combo Creator', description: 'Create your first layering combo', category: 'exploration', check: (s) => s.combos >= 1, xpReward: 20 },
  { id: 'level_5', icon: 'emoji_events', name: 'Rising Star', description: 'Reach Level 5', category: 'exploration', check: (s) => s.level >= 5, xpReward: 50 },
  { id: 'level_10', icon: 'diamond', name: 'Diamond Nose', description: 'Reach Level 10', category: 'exploration', check: (s) => s.level >= 10, xpReward: 150 },
]

const CATEGORY_META: Record<string, { label: string; icon: string; color: string }> = {
  collection: { label: 'Collection', icon: 'inventory_2', color: 'text-primary' },
  wearing: { label: 'Wearing', icon: 'checkroom', color: 'text-tertiary' },
  social: { label: 'Social', icon: 'groups', color: 'text-secondary' },
  exploration: { label: 'Exploration', icon: 'explore', color: 'text-primary-fixed' },
}

export function AchievementsScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
    if (!user) { setLoading(false); return }

    async function fetchStats() {
      const [ownedRes, wishlistRes, wearsRes, reviewsRes, boardsRes, combosRes, listsRes, decantsRes, profileRes, collectionsRes] = await Promise.all([
        supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'own'),
        supabase.from('user_collections').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('status', 'wishlist'),
        supabase.from('wear_logs').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('scent_boards').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('layering_combos').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('custom_lists').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('decants').select('id', { count: 'exact', head: true }).eq('user_id', user!.id),
        supabase.from('profiles').select('level, xp').eq('id', user!.id).single(),
        supabase.from('user_collections').select('fragrance:fragrances(brand, note_family)').eq('user_id', user!.id).eq('status', 'own'),
      ])

      // Calculate unique brands and families
      type CollJoin = { fragrance: { brand: string; note_family: string | null } | null }
      const collData = (collectionsRes.data ?? []) as CollJoin[]
      const brands = new Set<string>()
      const families = new Set<string>()
      collData.forEach((c) => {
        if (c.fragrance?.brand) brands.add(c.fragrance.brand)
        if (c.fragrance?.note_family) families.add(c.fragrance.note_family)
      })

      // Calculate streak
      const { data: recentWears } = await supabase
        .from('wear_logs')
        .select('wear_date')
        .eq('user_id', user!.id)
        .order('wear_date', { ascending: false })
        .limit(60)

      let streak = 0
      if (recentWears && recentWears.length > 0) {
        const dates = [...new Set(recentWears.map((w) => w.wear_date))].sort().reverse()
        const today = new Date().toISOString().slice(0, 10)
        if (dates[0] === today || dates[0] === getPrevDay(today)) {
          streak = 1
          for (let i = 1; i < dates.length; i++) {
            if (dates[i] === getPrevDay(dates[i - 1])) streak++
            else break
          }
        }
      }

      setStats({
        owned: ownedRes.count ?? 0,
        wishlist: wishlistRes.count ?? 0,
        wears: wearsRes.count ?? 0,
        reviews: reviewsRes.count ?? 0,
        boards: boardsRes.count ?? 0,
        streak,
        uniqueBrands: brands.size,
        uniqueFamilies: families.size,
        combos: combosRes.count ?? 0,
        lists: listsRes.count ?? 0,
        decants: decantsRes.count ?? 0,
        level: profileRes.data?.level ?? 1,
      })
      setLoading(false)
    }

    fetchStats()
  }, [user])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <Icon name="emoji_events" className="text-5xl text-primary/30" />
        <p className="text-secondary/60 text-sm">Sign in to track achievements</p>
        <button onClick={() => navigate('/profile')} className="gold-gradient text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest">
          Sign In
        </button>
      </main>
    )
  }

  if (loading || !stats) {
    return (
      <main className="pt-24 pb-32 px-6 flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    )
  }

  const unlocked = ACHIEVEMENTS.filter((a) => a.check(stats))
  const locked = ACHIEVEMENTS.filter((a) => !a.check(stats))
  const totalXP = unlocked.reduce((sum, a) => sum + a.xpReward, 0)
  const categories = ['all', 'collection', 'wearing', 'social', 'exploration']

  const filtered = activeCategory === 'all'
    ? ACHIEVEMENTS
    : ACHIEVEMENTS.filter((a) => a.category === activeCategory)

  const filteredUnlocked = filtered.filter((a) => a.check(stats))
  const filteredLocked = filtered.filter((a) => !a.check(stats))

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Summary Header */}
      <section className="text-center mb-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Icon name="emoji_events" filled className="text-4xl text-primary" />
        </div>
        <h2 className="font-headline text-2xl mb-1">{unlocked.length} / {ACHIEVEMENTS.length}</h2>
        <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/60">Achievements Unlocked</p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="text-center">
            <p className="font-headline text-lg text-primary">{totalXP}</p>
            <p className="text-[9px] text-secondary/50 uppercase tracking-wider">XP Earned</p>
          </div>
          <div className="w-px h-8 bg-outline-variant" />
          <div className="text-center">
            <p className="font-headline text-lg text-primary">{stats.level}</p>
            <p className="text-[9px] text-secondary/50 uppercase tracking-wider">{getLevelTitle(stats.level)}</p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 mx-auto max-w-[280px]">
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${(unlocked.length / ACHIEVEMENTS.length) * 100}%` }}
            />
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 -mx-6 px-6">
        {categories.map((cat) => {
          const isActive = activeCategory === cat
          const catCount = cat === 'all'
            ? ACHIEVEMENTS.filter((a) => a.check(stats)).length
            : ACHIEVEMENTS.filter((a) => a.category === cat && a.check(stats)).length
          const catTotal = cat === 'all' ? ACHIEVEMENTS.length : ACHIEVEMENTS.filter((a) => a.category === cat).length
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                isActive ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/70'
              }`}
            >
              {cat !== 'all' && <Icon name={CATEGORY_META[cat].icon} size={14} />}
              <span>{cat === 'all' ? 'All' : CATEGORY_META[cat].label}</span>
              <span className={`text-[9px] ${isActive ? 'text-on-primary/70' : 'text-secondary/40'}`}>
                {catCount}/{catTotal}
              </span>
            </button>
          )
        })}
      </div>

      {/* Unlocked */}
      {filteredUnlocked.length > 0 && (
        <section className="mb-8">
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-primary font-bold mb-3">
            UNLOCKED ({filteredUnlocked.length})
          </h3>
          <div className="space-y-2">
            {filteredUnlocked.map((ach) => (
              <AchievementCard key={ach.id} achievement={ach} unlocked />
            ))}
          </div>
        </section>
      )}

      {/* Locked */}
      {filteredLocked.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">
            LOCKED ({filteredLocked.length})
          </h3>
          <div className="space-y-2">
            {filteredLocked.map((ach) => (
              <AchievementCard key={ach.id} achievement={ach} unlocked={false} />
            ))}
          </div>
        </section>
      )}

      {/* Empty filter state */}
      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Icon name="emoji_events" className="text-4xl text-secondary/20 mb-3" />
          <p className="text-secondary/40 text-sm">No achievements in this category</p>
        </div>
      )}
    </main>
  )
}

function AchievementCard({ achievement, unlocked }: { achievement: AchievementDef; unlocked: boolean }) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
      unlocked ? 'bg-surface-container' : 'bg-surface-container/40 opacity-50'
    }`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
        unlocked ? 'bg-primary/15' : 'bg-surface-container-highest'
      }`}>
        <Icon
          name={unlocked ? achievement.icon : 'lock'}
          filled={unlocked}
          className={`text-xl ${unlocked ? 'text-primary' : 'text-secondary/30'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${unlocked ? 'text-on-surface' : 'text-secondary/60'}`}>
          {achievement.name}
        </p>
        <p className="text-[10px] text-secondary/50">{achievement.description}</p>
      </div>
      <div className={`flex items-center gap-1 flex-shrink-0 ${unlocked ? 'text-primary' : 'text-secondary/30'}`}>
        <span className="text-[10px] font-bold">+{achievement.xpReward}</span>
        <span className="text-[9px]">XP</span>
      </div>
    </div>
  )
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
