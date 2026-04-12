import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Fragrance } from '@/types/database'

/* ── Weather conditions → fragrance character mapping ── */
interface WeatherData {
  temp: number       // °C
  humidity: number   // %
  condition: string  // clear, clouds, rain, snow, mist, thunderstorm
  description: string
  city: string
}

const WEATHER_ICONS: Record<string, string> = {
  clear: '☀️', clouds: '☁️', rain: '🌧️', drizzle: '🌦️',
  snow: '❄️', mist: '🌫️', thunderstorm: '⛈️', fog: '🌫️',
}

const WEATHER_ACCORDS: Record<string, string[]> = {
  hot_dry: ['citrus', 'aquatic', 'aromatic', 'fresh', 'green', 'ozonic'],
  hot_humid: ['citrus', 'aquatic', 'fresh', 'green', 'tropical'],
  warm: ['floral', 'fruity', 'green', 'aromatic', 'citrus', 'rose'],
  cool: ['woody', 'spicy', 'amber', 'leather', 'tobacco', 'warm spicy'],
  cold: ['oriental', 'amber', 'vanilla', 'oud', 'leather', 'balsamic', 'woody'],
  rainy: ['petrichor', 'earthy', 'green', 'aquatic', 'mossy', 'woody'],
}

function getWeatherProfile(weather: WeatherData): { key: string; label: string; tip: string; accords: string[] } {
  if (weather.condition === 'rain' || weather.condition === 'drizzle' || weather.condition === 'thunderstorm') {
    return { key: 'rainy', label: 'Rainy', tip: 'Go earthy and green — petrichor vibes', accords: WEATHER_ACCORDS.rainy }
  }
  if (weather.temp >= 30 && weather.humidity >= 60) return { key: 'hot_humid', label: 'Hot & Humid', tip: 'Light citrus and aquatics project best', accords: WEATHER_ACCORDS.hot_humid }
  if (weather.temp >= 28) return { key: 'hot_dry', label: 'Hot', tip: 'Fresh and airy — heat amplifies everything', accords: WEATHER_ACCORDS.hot_dry }
  if (weather.temp >= 18) return { key: 'warm', label: 'Warm', tip: 'Florals and fruits bloom beautifully', accords: WEATHER_ACCORDS.warm }
  if (weather.temp >= 8) return { key: 'cool', label: 'Cool', tip: 'Woody and spicy notes carry well', accords: WEATHER_ACCORDS.cool }
  return { key: 'cold', label: 'Cold', tip: 'Rich orientals and ambers shine in the cold', accords: WEATHER_ACCORDS.cold }
}

function scoreFragrance(fragrance: Fragrance, targetAccords: string[]): number {
  const fragranceAccords = (fragrance.accords ?? []).map(a => a.toLowerCase())
  const mainAccords = fragrance.main_accords_percentage ? Object.keys(fragrance.main_accords_percentage).map(a => a.toLowerCase()) : []
  const all = new Set([...fragranceAccords, ...mainAccords])
  let score = 0
  for (const target of targetAccords) {
    const t = target.toLowerCase()
    for (const a of all) {
      if (a.includes(t) || t.includes(a)) { score++; break }
    }
  }
  return score
}

export function WeatherMatchScreen() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [matches, setMatches] = useState<(Fragrance & { score: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [locationError, setLocationError] = useState<string | null>(null)

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      // Use Open-Meteo (free, no API key needed)
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`)
      const data = await res.json()
      const current = data.current

      // WMO weather code to condition
      const code = current.weather_code
      let condition = 'clear'
      if (code >= 1 && code <= 3) condition = 'clouds'
      else if (code >= 45 && code <= 48) condition = 'mist'
      else if (code >= 51 && code <= 57) condition = 'drizzle'
      else if (code >= 61 && code <= 67) condition = 'rain'
      else if (code >= 71 && code <= 77) condition = 'snow'
      else if (code >= 80 && code <= 82) condition = 'rain'
      else if (code >= 95) condition = 'thunderstorm'

      // Reverse geocode for city name
      let city = 'Your Location'
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`)
        const geoData = await geoRes.json()
        city = geoData.address?.city || geoData.address?.town || geoData.address?.village || 'Your Location'
      } catch { /* ignore */ }

      return {
        temp: Math.round(current.temperature_2m),
        humidity: current.relative_humidity_2m,
        condition,
        description: condition.charAt(0).toUpperCase() + condition.slice(1),
        city,
      }
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    if (!user) { setLoading(false); return }

    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const w = await fetchWeather(pos.coords.latitude, pos.coords.longitude)
        if (!w) { setLocationError('Could not fetch weather'); setLoading(false); return }
        setWeather(w)

        // Fetch collection and score
        const { data } = await supabase
          .from('user_collections')
          .select('fragrance:fragrances(*)')
          .eq('user_id', user!.id)
          .eq('status', 'own')

        type Row = { fragrance: Fragrance | null }
        const rows = (data ?? []) as unknown as Row[]
        const frags = rows.filter(r => r.fragrance).map(r => r.fragrance!)

        const profile = getWeatherProfile(w)
        const scored = frags
          .map(f => ({ ...f, score: scoreFragrance(f, profile.accords) }))
          .filter(f => f.score > 0)
          .sort((a, b) => b.score - a.score)

        setMatches(scored.slice(0, 10))
        setLoading(false)
      },
      () => {
        setLocationError('Location access denied')
        setLoading(false)
      },
      { timeout: 10000 }
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  if (!user) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-5xl text-primary/30">?</span>
        <p className="text-secondary/60 text-sm">Sign in for weather-matched picks</p>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="flex flex-col items-center gap-1.5">{[1,2,3].map(i => <div key={i} className="h-1 rounded-sm bg-primary/20 animate-pulse" style={{ width: `${60 - i * 14}px` }} />)}</div>
        <p className="text-xs text-secondary/40 animate-pulse">Checking the weather...</p>
      </main>
    )
  }

  if (locationError) {
    return (
      <main className="pt-24 pb-32 px-6 flex flex-col items-center justify-center min-h-screen gap-4">
        <span className="text-4xl text-primary/20">?</span>
        <p className="text-sm text-on-surface-variant">{locationError}</p>
        <p className="text-xs text-secondary/40">Enable location access to get weather-matched picks</p>
      </main>
    )
  }

  if (!weather) return null

  const profile = getWeatherProfile(weather)

  return (
    <main className="pt-24 pb-32 px-4 max-w-[430px] mx-auto min-h-screen space-y-6">
      {/* Weather card */}
      <div className="bg-surface-container rounded-sm p-5 text-center space-y-2">
        <p className="text-4xl">{WEATHER_ICONS[weather.condition] ?? '🌤️'}</p>
        <div className="flex items-center justify-center gap-3">
          <span className="font-headline text-3xl text-on-surface">{weather.temp}°</span>
          <div className="text-left">
            <p className="text-sm text-on-surface font-medium">{weather.description}</p>
            <p className="text-[10px] text-secondary/50">{weather.city} · {weather.humidity}% humidity</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-surface-container-highest">
          <p className="text-[9px] uppercase tracking-[0.15em] text-primary font-bold">{profile.label} Weather</p>
          <p className="text-xs text-on-surface-variant mt-1">{profile.tip}</p>
        </div>
      </div>

      {/* Matching accords */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-2">IDEAL ACCORDS TODAY</p>
        <div className="flex flex-wrap gap-2">
          {profile.accords.map(accord => (
            <span key={accord} className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium capitalize">{accord}</span>
          ))}
        </div>
      </div>

      {/* Matched fragrances */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-secondary/50 font-bold mb-3">YOUR BEST PICKS</p>
        {matches.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl text-primary/20 mb-2">?</span>
            <p className="text-xs text-secondary/40">No strong matches in your collection</p>
            <p className="text-[10px] text-secondary/30 mt-1">Try adding fragrances with {profile.accords.slice(0, 2).join(' or ')} notes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((f, i) => (
              <button
                key={f.id}
                onClick={() => navigate(`/fragrance/${f.id}`)}
                className="w-full flex items-center gap-3 bg-surface-container rounded-sm p-3 hover:opacity-80 transition-transform text-left"
              >
                {i === 0 && <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full gold-gradient text-on-primary-container text-[8px] font-bold flex items-center justify-center">★</span>}
                <div className="w-12 h-12 rounded-sm overflow-hidden bg-surface-container-low flex-shrink-0 relative">
                  {f.image_url ? (
                    <img src={f.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-primary/20">?</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface font-medium truncate">{f.name}</p>
                  <p className="text-[10px] text-secondary/50">{f.brand}</p>
                  {f.accords && (
                    <div className="flex gap-1 mt-1 overflow-hidden">
                      {f.accords.slice(0, 3).map(a => (
                        <span key={a} className={`text-[8px] px-1.5 py-0.5 rounded-full ${profile.accords.some(pa => a.toLowerCase().includes(pa.toLowerCase())) ? 'bg-primary/15 text-primary' : 'bg-surface-container-highest text-secondary/40'}`}>{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[9px] text-primary font-bold">{Math.round((f.score / profile.accords.length) * 100)}%</p>
                  <p className="text-[8px] text-secondary/30">match</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
