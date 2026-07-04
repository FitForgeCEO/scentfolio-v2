// ── Terms of Service ────────────────────────────────────────────────
// Placeholder terms shipped for the public opening (Pre-Public-Opening-
// Audit 04 Jul 2026, P0-6). Plain-language, not lawyer-reviewed — the bar
// is "accessible and honest". Update before any marketed launch.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-headline text-lg text-on-surface">{title}</h2>
      <div className="text-sm text-secondary leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export function TermsScreen() {
  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header className="space-y-1">
        <h1 className="font-headline text-3xl text-on-background">Terms of Service</h1>
        <p className="text-[11px] text-secondary/60">Last updated 4 July 2026</p>
      </header>

      <p className="text-sm text-secondary leading-relaxed">
        These terms govern your use of ScentFolio. By creating an account or using the
        app, you agree to them. If you do not agree, please do not use the service.
      </p>

      <Section title="The service">
        <p>
          ScentFolio lets you catalogue your fragrance collection, log wears, write
          reviews, and discover new scents. The app is provided free of charge and is
          offered "as is", without warranties. Features may change or be removed.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You are responsible for keeping your password secure and for activity under
          your account. You must be old enough to consent to data processing in your
          country (generally 16 in the UK/EU, or 13 with appropriate consent). Provide
          accurate information when signing up.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          You own the content you add — your collection, reviews, and notes. You grant us
          the limited permission needed to store and display it back to you, and to show
          it to others only where you explicitly choose to make something public (such as
          a public profile or shared review).
        </p>
        <p>
          Do not post unlawful, abusive, or infringing content. We may remove content or
          suspend accounts that break these terms or harm other users.
        </p>
      </Section>

      <Section title="Fragrance data">
        <p>
          The fragrance catalogue, notes, and recommendations are provided for
          informational purposes and may contain inaccuracies. Nothing in the app is
          professional, medical, or purchasing advice. Verify details before making
          buying decisions.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>
          Do not attempt to disrupt the service, scrape it at scale, abuse rate limits,
          reverse-engineer it for a competing product, or access other users' data. We
          may rate-limit or suspend accounts that do.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can stop using ScentFolio and delete your data at any time from Settings.
          We may suspend or close accounts that violate these terms.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential
          loss arising from use of the app. Nothing here limits liability that cannot be
          limited by law.
        </p>
      </Section>

      <Section title="Changes & contact">
        <p>
          We may update these terms; continued use after a change means you accept the
          updated terms. Questions:{' '}
          <a href="mailto:hello@scentfolio.app" className="text-primary hover:underline">hello@scentfolio.app</a>.
        </p>
      </Section>
    </main>
  )
}
