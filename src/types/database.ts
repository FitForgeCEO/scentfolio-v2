export interface Fragrance {
  id: string
  brand: string
  name: string
  concentration: string | null
  gender: string | null
  year_released: number | null
  image_url: string | null
  notes_top: string[] | null
  notes_heart: string[] | null
  notes_base: string[] | null
  note_family: string | null
  accords: string[] | null
  general_notes: string[] | null
  main_accords_percentage: Record<string, string> | null
  longevity: number | null
  sillage: number | null
  rating: number | null
  country: string | null
  popularity: string | null
  price: string | null
  price_value: string | null
  season_ranking: SeasonRanking[] | null
  occasion_ranking: OccasionRanking[] | null
  is_approved: boolean
  created_at: string
}

export interface SeasonRanking {
  name: string
  score: number
}

export interface OccasionRanking {
  name: string
  score: number
}

export interface UserCollection {
  id: string
  user_id: string
  fragrance_id: string
  status: 'own' | 'wishlist' | 'sampled' | 'sold'
  personal_rating: number | null
  personal_notes: string | null
  date_added: string
  fragrance?: Fragrance
}

export interface WearLog {
  id: string
  user_id: string
  fragrance_id: string
  wear_date: string
  occasion: string | null
  created_at: string
  fragrance?: Fragrance
}

export interface Review {
  id: string
  user_id: string
  fragrance_id: string
  overall_rating: number
  longevity_rating: number | null
  sillage_rating: number | null
  scent_rating: number | null
  value_rating: number | null
  season_tags: string[] | null
  occasion_tags: string[] | null
  review_text: string | null
  title: string | null
  would_recommend: boolean | null
  created_at: string
  profile?: Profile
}

export interface Profile {
  id: string
  display_name: string
  avatar_url: string | null
  level: number
  xp: number
  created_at: string
}

export interface FragranceTag {
  id: string
  user_id: string
  fragrance_id: string
  tag: string
  created_at: string
}
