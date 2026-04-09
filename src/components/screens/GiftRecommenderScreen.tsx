import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { useGiftRecommender, OCCASION_OPTIONS, VIBE_OPTIONS } from '@/hooks/useGiftRecommender'

const GENDER_OPTIONS = [
  { value: 'any' as const, label: 'Anyone' },
  { value: 'female' as const, label: 'Her' },
  { value: 'male' as const, label: 'Him' },
  { value: 'unisex' as const, label: 'Unisex' },
]

const AGE_OPTIONS = [
  { value: 'any' as const, label: 'Any age' },
  { value: '18-25' as const, label: '18–25' },
  { value: '26-35' as const, label: '26–35' },
  { value: '36-50' as const, label: '36–50' },
  { value: '50+' as const, label: '50+' },
]

const BUDGET_OPTIONS = [
  { value: 'any' as const, label: 'Any' },
  { value: 'low' as const, label: 'Under £40', icon: '💰' },
  { value: 'mid' as const, label: '£40–100', icon: '💎' },
  { value: 'high' as const, label: '£100+', icon: '👑' },
]

export function GiftRecommenderScreen() {
  const navigate = useNavigate()
  const { prefs, updatePref, toggleVibe, results, loading, searched, search } = useGiftRecommender()

  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen">
      {/* Header */}
      <section className="mb-6">
        <h1 className="font-headline text-2xl text-on-surface mb-1">Gift Finder</h1>
        <p className="text-xs text-secondary/50">Find the perfect fragrance gift</p>
      </section>

      {/* Who is it for? */}
      <section className="mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-2">WHO IS IT FOR?</h3>
        <div className="flex gap-2">
          {GENDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('gender', opt.value)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                prefs.gender === opt.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Age range */}
      <section className="mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-2">AGE RANGE</h3>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {AGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('ageRange', opt.value)}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-colors ${
                prefs.ageRange === opt.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Occasion */}
      <section className="mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-2">OCCASION</h3>
        <div className="flex flex-wrap gap-2">
          {OCCASION_OPTIONS.map(occ => (
            <button
              key={occ}
              onClick={() => updatePref('occasion', prefs.occasion === occ ? '' : occ)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                prefs.occasion === occ ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {occ}
            </button>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="mb-5">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-2">BUDGET</h3>
        <div className="flex gap-2">
          {BUDGET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => updatePref('budget', opt.value)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                prefs.budget === opt.value ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {/* Vibes */}
      <section className="mb-6">
        <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-2">
          VIBES <span className="text-secondary/30">(pick up to 3)</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map(vibe => (
            <button
              key={vibe}
              onClick={() => toggleVibe(vibe)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                prefs.vibes.includes(vibe) ? 'bg-primary text-on-primary' : 'bg-surface-container text-secondary/60'
              }`}
            >
              {vibe}
            </button>
          ))}
        </div>
      </section>

      {/* Search button */}
      <button
        onClick={search}
        disabled={loading}
        className="w-full gold-gradient text-on-primary-container py-3.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 mb-8"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-on-primary-container/30 border-t-on-primary-container rounded-full animate-spin" />
        ) : (
          <>
            <Icon name="card_giftcard" size={16} />
            FIND GIFTS
          </>
        )}
      </button>

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Icon name="search_off" className="text-4xl text-primary/20" />
          <p className="text-sm text-secondary/50">No matches found. Try adjusting your preferences.</p>
        </div>
      )}

      {results.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary mb-3">
            {results.length} RECOMMENDATION{results.length !== 1 ? 'S' : ''}
          </h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <button
                key={r.fragrance.id}
                onClick={() => navigate(`/fragrance/${r.fragrance.id}`)}
                className="w-full flex items-center gap-3 bg-surface-container rounded-2xl p-3 text-left active:scale-[0.98] transition-transform"
              >
                {/* Rank */}
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                </div>

                {/* Image */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-highest flex-shrink-0">
                  {r.fragrance.image_url ? (
                    <img src={r.fragrance.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="water_drop" className="text-secondary/20" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{r.fragrance.name}</p>
                  <p className="text-[10px] text-secondary/50">{r.fragrance.brand}</p>
                  {r.reasons.length > 0 && (
                    <p className="text-[9px] text-primary/60 mt-0.5 truncate">{r.reasons.slice(0, 2).join(' · ')}</p>
                  )}
                </div>

                <Icon name="chevron_right" className="text-secondary/30" size={16} />
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
