import { Icon } from '../ui/Icon'

export function LayeringLabScreen() {
  return (
    <main className="pt-24 pb-32 px-6 max-w-[375px] mx-auto overflow-x-hidden">
      {/* Vibe Statement */}
      <section className="py-12 flex flex-col items-center text-center">
        <div className="w-12 h-[1px] bg-primary/40 mb-8" />
        <p className="font-headline italic text-2xl text-primary leading-relaxed px-4">
          "Warm amber meets midnight smoke — a scent that lingers in the memory"
        </p>
        <div className="w-12 h-[1px] bg-primary/40 mt-8" />
      </section>

      {/* Step Cards */}
      <section className="space-y-6">
        {/* STEP 1 — Body Prep */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6">
          <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim block mb-3">
            STEP 1 · BODY PREP
          </span>
          <h3 className="font-headline text-xl mb-1">Moroccan Argan Body Oil</h3>
          <p className="font-label text-xs uppercase tracking-wider text-outline-variant mb-4">Rituals</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {['Argan', 'Amber', 'Sweet Almond'].map((note) => (
              <span
                key={note}
                className="text-[10px] font-semibold text-primary uppercase tracking-widest bg-primary/5 px-2 py-1 rounded"
              >
                {note}
              </span>
            ))}
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Apply to pulse points after shower while skin is still damp.
          </p>
        </div>

        {/* STEP 2 — Base Layer */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6 border-l-2 border-primary/30 flex gap-4">
          <div className="w-16 h-20 bg-surface-container-highest rounded-lg overflow-hidden flex-shrink-0">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJpsGyW3I733Ai0RCvI_zw6zEsDLOkxI-18BvzraHpICfz7DkhaY_xlYQ2a6sE7Bl_KeKSYWBq-oMCyF5_jKa_Q9eMiAhtsAR8v7a9LoTDfkeibrnV93aiPzdR5D3Ev53Y6ZrkMPpgFl9otBIz9gEYZ4QT_6DVKRCKMgU0Gp6ffJqTigyMMKkWvRNNwe35lQUOFdk2Mjwv7FTOvjWeKq96Y-L_nzBcQ8zrLNHa8P9_hxT4xyIkmepvajWUhaLPIJ2qliVJCf8pNg-u"
              alt="Tobacco Vanille"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim block mb-1">
              STEP 2 · BASE LAYER
            </span>
            <h3 className="font-headline text-lg mb-0.5">Tobacco Vanille</h3>
            <p className="font-label text-[10px] uppercase tracking-wider text-outline-variant mb-3">Tom Ford</p>
            <p className="text-sm text-on-surface-variant leading-tight">
              3-4 sprays to chest, wrists, and neck.
            </p>
          </div>
        </div>

        {/* STEP 3 — Top Layer */}
        <div className="bg-surface-container rounded-xl overflow-hidden p-6">
          <div className="flex justify-between items-start mb-3">
            <span className="font-label text-[10px] tracking-[0.15em] text-secondary-fixed-dim">
              STEP 3 · TOP LAYER
            </span>
            <span className="bg-primary/15 text-primary text-[9px] font-bold px-2 py-0.5 rounded tracking-tighter uppercase">
              IN YOUR COLLECTION
            </span>
          </div>
          <h3 className="font-headline text-xl mb-1">Byredo Gypsy Water</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mt-4">
            2 sprays — inner wrists and behind ears.
          </p>
        </div>

        {/* Why It Works */}
        <div className="bg-surface-container rounded-xl p-6 border border-primary/10">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="lightbulb" className="text-primary text-lg" />
            <span className="font-label text-[10px] font-bold tracking-[0.2em] text-primary">WHY THIS WORKS</span>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed italic">
            The creamy base of Argan oil anchors the volatile citrus notes of Gypsy Water, while the smoky
            spice of Tobacco Vanille acts as a bridge, creating a deep, multifaceted signature scent that
            evolves throughout the day.
          </p>
        </div>

        {/* Pro Tip */}
        <div className="bg-primary/5 rounded-xl p-5 flex gap-4 items-start">
          <Icon name="auto_awesome" filled className="text-primary" />
          <div>
            <span className="font-label text-[10px] font-bold tracking-[0.2em] text-primary block mb-1">PRO TIP</span>
            <p className="text-xs text-on-surface leading-normal">
              Layer from lightest to heaviest concentration for best projection and longevity.
            </p>
          </div>
        </div>
      </section>

      {/* Action Buttons */}
      <section className="mt-12 space-y-4">
        <div className="flex gap-3">
          <button className="flex-1 h-14 bg-surface-container rounded-xl font-label text-[11px] font-bold tracking-widest uppercase text-on-surface active:opacity-70 transition-all">
            Try Another Vibe
          </button>
          <button className="flex-1 h-14 gold-gradient rounded-xl font-label text-[11px] font-bold tracking-widest uppercase text-on-primary active:opacity-70 transition-all flex items-center justify-center gap-2">
            <Icon name="share" size={16} />
            Share Stack
          </button>
        </div>
        <button className="w-full h-16 gold-gradient rounded-xl font-label text-xs font-bold tracking-[0.2em] uppercase text-on-primary active:opacity-70 transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/40">
          <Icon name="auto_awesome" filled />
          Save This Stack
        </button>
      </section>
    </main>
  )
}
