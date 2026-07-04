// ── Privacy Policy ──────────────────────────────────────────────────
// Placeholder GDPR-baseline notice shipped for the public opening
// (Pre-Public-Opening-Audit 04 Jul 2026, P0-6). Plain-language, not
// lawyer-reviewed — the bar is "accessible and honest", not final legal
// copy. Update the contact address + effective date before wide launch.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-headline text-lg text-on-surface">{title}</h2>
      <div className="text-sm text-secondary leading-relaxed space-y-2">{children}</div>
    </section>
  )
}

export function PrivacyScreen() {
  return (
    <main className="pt-24 pb-32 px-6 max-w-[430px] mx-auto min-h-screen space-y-6">
      <header className="space-y-1">
        <h1 className="font-headline text-3xl text-on-background">Privacy Policy</h1>
        <p className="text-[11px] text-secondary/60">Last updated 4 July 2026</p>
      </header>

      <p className="text-sm text-secondary leading-relaxed">
        ScentFolio ("we", "us") is a fragrance-collection app. This notice explains
        what personal data we hold, why, and the rights you have over it. We aim to
        collect as little as possible.
      </p>

      <Section title="What we collect">
        <p>
          <strong className="text-on-surface">Account data:</strong> your email address,
          display name, and password (stored hashed by our authentication provider — we
          never see it in plain text).
        </p>
        <p>
          <strong className="text-on-surface">Your content:</strong> the fragrances,
          wear logs, reviews, ratings, lists, and notes you add. This is the data the
          app exists to store for you.
        </p>
        <p>
          <strong className="text-on-surface">Usage analytics:</strong> anonymous,
          aggregated events (pages viewed, features used) to understand how the app is
          used. Signed-out events are recorded without any user identifier.
        </p>
        <p>
          <strong className="text-on-surface">Error diagnostics:</strong> if something
          crashes, we log the technical error. We do not attach your email, password,
          or IP address to these reports.
        </p>
      </Section>

      <Section title="Legal basis (UK/EU)">
        <p>
          We process account data and your content to perform the service you signed up
          for (contract). We process analytics and error diagnostics on the basis of our
          legitimate interest in keeping the app working and improving it, minimised so
          as not to identify you.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>We do not sell your data. We use a small number of processors to run the app:</p>
        <p>
          <strong className="text-on-surface">Supabase</strong> — database, authentication,
          and hosting of your account and content.<br />
          <strong className="text-on-surface">Sentry</strong> — error diagnostics.<br />
          <strong className="text-on-surface">MailerLite</strong> — only if you join a
          mailing list; used to send email you opted into.
        </p>
      </Section>

      <Section title="Cookies & local storage">
        <p>
          We use essential storage only — an authentication session token that keeps you
          signed in, and local preferences (such as theme). These are required for the
          app to function and are exempt from consent requirements. We do not use
          advertising or cross-site tracking cookies.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can access, correct, export, or delete your data at any time. Most of this
          is self-serve in <strong className="text-on-surface">Settings</strong> and
          <strong className="text-on-surface"> Data &amp; Export</strong>. To request full
          erasure of your account, contact us at the address below and we will remove your
          account and associated data.
        </p>
        <p>
          If you are in the UK/EU you also have the right to complain to your local data
          protection authority.
        </p>
      </Section>

      <Section title="Retention">
        <p>
          We keep your data for as long as your account exists. When you delete your
          account, we remove your personal content. Anonymous, aggregated analytics that
          cannot identify you may be retained.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions or requests: <a href="mailto:hello@scentfolio.app" className="text-primary hover:underline">hello@scentfolio.app</a>.
        </p>
      </Section>
    </main>
  )
}
