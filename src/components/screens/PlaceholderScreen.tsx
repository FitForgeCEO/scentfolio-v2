interface PlaceholderScreenProps {
  title: string
  icon: string
}

export function PlaceholderScreen({ title, icon }: PlaceholderScreenProps) {
  return (
    <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen">
      <span className="material-symbols-outlined text-6xl text-primary/30 mb-4">{icon}</span>
      <h2 className="font-headline text-2xl text-on-surface mb-2">{title}</h2>
      <p className="text-sm text-secondary/60 text-center">Coming soon</p>
    </main>
  )
}
