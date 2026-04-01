/**
 * Maps fragrance note names (from Supabase) → icon filenames in /public/note-icons/
 *
 * Strategy: normalize the Supabase note name to lowercase, then look up in this map.
 * The map covers 200+ note variants found across 2,706 fragrances.
 * Unmapped notes get a generic fallback icon (water-drop.png).
 */

const NOTE_ICON_MAP: Record<string, string> = {
  // ── CITRUS ──────────────────────────────────────────────
  'bergamot': 'bergamot',
  'calabrian bergamot': 'bergamot',
  'italian bergamot': 'bergamot',
  'lemon': 'lemon',
  'amalfi lemon': 'lemon',
  'sicilian lemon': 'lemon',
  'lemon verbena': 'lemon-verbena',
  'orange': 'orange',
  'bitter orange': 'bitter-orange',
  'blood orange': 'blood-orange',
  'mandarin orange': 'mandarin-orange',
  'green mandarin': 'mandarin-orange',
  'mandarin': 'mandarin-orange',
  'tangerine': 'tangerine',
  'clementine': 'clementine',
  'grapefruit': 'grapefruit',
  'grapefruit blossom': 'grapefruit-blossom',
  'lime': 'lime',
  'yuzu': 'yuzu',
  'citron': 'citron',
  'kumquat': 'kumquat',
  'citruses': 'lemon',
  'citrus': 'lemon',
  'petitgrain': 'petitgrain',

  // ── FLORAL ──────────────────────────────────────────────
  'rose': 'rose',
  'bulgarian rose': 'rose',
  'turkish rose': 'rose',
  'damask rose': 'rose',
  'may rose': 'rose',
  'red rose': 'rose',
  'jasmine': 'jasmine',
  'jasmine sambac': 'jasmine',
  'egyptian jasmine': 'jasmine',
  'indian jasmine': 'jasmine',
  'neroli': 'neroli',
  'orange blossom': 'orange-blossom',
  'african orange flower': 'orange-blossom',
  'ylang-ylang': 'ylang-ylang',
  'ylang ylang': 'ylang-ylang',
  'iris': 'iris',
  'orris root': 'iris',
  'orris': 'iris',
  'violet': 'violet',
  'violet leaf': 'violet',
  'peony': 'peony',
  'lily-of-the-valley': 'lily-of-the-valley',
  'lily of the valley': 'lily-of-the-valley',
  'muguet': 'lily-of-the-valley',
  'lily': 'lily',
  'magnolia': 'magnolia',
  'tuberose': 'tuberose',
  'freesia': 'freesia',
  'carnation': 'carnation',
  'orchid': 'orchid',
  'geranium': 'geranium',
  'mimosa': 'mimosa',
  'lotus': 'lotus',
  'waterlily': 'waterlily',
  'water lily': 'waterlily',
  'cherry blossom': 'cherry-blossom',
  'hibiscus': 'hibiscus',
  'gardenia': 'jasmine', // close family
  'honeysuckle': 'jasmine', // floral fallback
  'frangipani': 'jasmine',
  'narcissus': 'lily',
  'cyclamen': 'lily',
  'lilac': 'lavender',
  'floral notes': 'rose',
  'white flowers': 'jasmine',

  // ── HERBAL / GREEN / AROMATIC ───────────────────────────
  'lavender': 'lavender',
  'french lavender': 'lavender',
  'sage': 'sage',
  'clary sage': 'sage',
  'basil': 'basil',
  'rosemary': 'rosemary',
  'thyme': 'thyme',
  'mint': 'mint',
  'peppermint': 'mint',
  'spearmint': 'mint',
  'eucalyptus': 'eucalyptus',
  'fern': 'fern',
  'grass': 'grass',
  'green notes': 'grass',
  'green tea': 'green-tea',
  'tea': 'green-tea',
  'ivy': 'ivy',
  'hemp': 'hemp',
  'bamboo': 'bamboo',
  'fig leaf': 'fig-leaf',
  'artemisia': 'sage',
  'galbanum': 'grass',

  // ── SPICY ───────────────────────────────────────────────
  'pink pepper': 'pink-pepper',
  'black pepper': 'black-pepper',
  'pepper': 'black-pepper',
  'sichuan pepper': 'pink-pepper',
  'cardamom': 'cardamom',
  'cinnamon': 'cinnamon',
  'clove': 'clove',
  'cloves': 'clove',
  'nutmeg': 'nutmeg',
  'ginger': 'ginger',
  'saffron': 'saffron',
  'coriander': 'coriander',
  'cumin': 'cumin',
  'star anise': 'star-anise',
  'caraway': 'coriander',
  'spices': 'cinnamon',

  // ── WOODY ───────────────────────────────────────────────
  'sandalwood': 'sandalwood',
  'indian sandalwood': 'sandalwood',
  'australian sandalwood': 'sandalwood',
  'cedar': 'cedar',
  'cedarwood': 'cedar',
  'virginia cedar': 'cedar',
  'atlas cedar': 'cedar',
  'patchouli': 'patchouli',
  'dark patchouli': 'patchouli',
  'vetiver': 'vetiver',
  'haitian vetiver': 'vetiver',
  'guaiac wood': 'guaiac-wood',
  'guaiacwood': 'guaiac-wood',
  'cypress': 'cypress',
  'pine': 'pine',
  'juniper': 'juniper',
  'juniper berries': 'juniper',
  'birch': 'birch',
  'rosewood': 'rosewood',
  'brazilian rosewood': 'rosewood',
  'teak': 'teak',
  'ebony': 'ebony',
  'driftwood': 'driftwood',
  'agarwood (oud)': 'oud',
  'oud': 'oud',
  'agarwood': 'oud',
  'woody notes': 'cedar',
  'woodsy notes': 'cedar',
  'cashmere wood': 'cashmere',
  'amberwood': 'cedar',

  // ── RESINOUS / BALSAMIC ─────────────────────────────────
  'amber': 'amber',
  'ambergris': 'ambergris',
  'ambroxan': 'amber',
  'benzoin': 'benzoin',
  'frankincense': 'frankincense',
  'incense': 'incense',
  'olibanum': 'frankincense',
  'labdanum': 'labdanum',
  'myrrh': 'myrrh',
  'opoponax': 'myrrh',
  'elemi': 'frankincense',
  'styrax': 'benzoin',

  // ── MUSK / ANIMALIC ─────────────────────────────────────
  'musk': 'musk',
  'white musk': 'white-musk',
  'cashmeran': 'cashmere',
  'cashmere': 'cashmere',
  'castoreum': 'castoreum',
  'ambrette (musk mallow)': 'musk',
  'ambrette': 'musk',
  'civet': 'musk',
  'leather': 'leather',
  'suede': 'suede',

  // ── GOURMAND ────────────────────────────────────────────
  'vanilla': 'vanilla',
  'vanille': 'vanilla',
  'madagascar vanilla': 'vanilla',
  'bourbon vanilla': 'vanilla',
  'tonka bean': 'tonka-bean',
  'tonka': 'tonka-bean',
  'caramel': 'caramel',
  'chocolate': 'chocolate',
  'cocoa': 'cocoa',
  'cacao': 'cocoa',
  'coffee': 'coffee',
  'honey': 'honey',
  'praline': 'praline',
  'almond': 'almond',
  'sugar': 'sugar',
  'rum': 'rum',
  'licorice': 'star-anise',
  'heliotrope': 'vanilla', // vanillic/almond scent

  // ── FRUITY ──────────────────────────────────────────────
  'apple': 'apple',
  'green apple': 'apple',
  'red apple': 'apple',
  'peach': 'peach',
  'pear': 'pear',
  'plum': 'plum',
  'fig': 'fig',
  'cherry': 'cherry',
  'raspberry': 'raspberry',
  'strawberry': 'strawberry',
  'blackberry': 'raspberry',
  'red berries': 'raspberry',
  'black currant': 'black-currant',
  'cassis': 'black-currant',
  'lychee': 'lychee',
  'litchi': 'lychee',
  'mango': 'mango',
  'pineapple': 'pineapple',
  'coconut': 'coconut',
  'passion fruit': 'passion-fruit',
  'passionfruit': 'passion-fruit',
  'pomegranate': 'pomegranate',

  // ── AQUATIC / FRESH / OZONIC ────────────────────────────
  'sea notes': 'sea-salt',
  'sea salt': 'sea-salt',
  'sea crystal': 'sea-crystal',
  'water notes': 'water-drop',
  'watery notes': 'water-drop',
  'rain': 'rain',
  'cloud': 'cloud',
  'wind': 'wind',
  'ozonic notes': 'wind',
  'marine notes': 'sea-salt',

  // ── POWDERY / TEXTILE ───────────────────────────────────
  'powder': 'powder',
  'talc': 'talc',
  'cotton': 'cotton',
  'silk': 'silk',

  // ── SMOKY / EARTHY ──────────────────────────────────────
  'smoke': 'smoke',
  'tobacco': 'tobacco',
  'charcoal': 'charcoal',
  'earth': 'earth',
  'moss': 'moss',
  'oakmoss': 'oak-moss',
  'oak moss': 'oak-moss',
  'peat': 'peat',
  'mushroom': 'mushroom',

  // ── MISC / MOLECULAR ────────────────────────────────────
  'aldehydes': 'cloud',
  'hedione': 'jasmine',
  'iso e super': 'cedar',
  'papyrus': 'bamboo',
  'osmanthus': 'peach', // peachy-apricot scent
  'cypriol oil or nagarmotha': 'patchouli',
}

/**
 * Resolve a fragrance note name to its icon filename.
 * Returns the filename (without extension) or 'water-drop' as fallback.
 */
export function getNoteIcon(noteName: string): string {
  const key = noteName.toLowerCase().trim()
  return NOTE_ICON_MAP[key] ?? 'water-drop'
}

/**
 * Get the full icon path for a note name.
 */
export function getNoteIconPath(noteName: string): string {
  return `/note-icons/${getNoteIcon(noteName)}.png`
}

/**
 * Colour families for note chips — maps icon names to a note family colour.
 * Used for subtle colour-coding in the pyramid.
 */
export type NoteFamily = 'citrus' | 'floral' | 'woody' | 'spicy' | 'resinous' | 'musk' | 'gourmand' | 'fruity' | 'green' | 'aquatic' | 'earthy' | 'powdery'

const ICON_TO_FAMILY: Record<string, NoteFamily> = {
  // Citrus
  bergamot: 'citrus', lemon: 'citrus', 'lemon-verbena': 'citrus', orange: 'citrus',
  'bitter-orange': 'citrus', 'blood-orange': 'citrus', 'mandarin-orange': 'citrus',
  tangerine: 'citrus', clementine: 'citrus', grapefruit: 'citrus',
  'grapefruit-blossom': 'citrus', lime: 'citrus', yuzu: 'citrus',
  citron: 'citrus', kumquat: 'citrus', petitgrain: 'citrus',

  // Floral
  rose: 'floral', jasmine: 'floral', neroli: 'floral', 'orange-blossom': 'floral',
  'ylang-ylang': 'floral', iris: 'floral', violet: 'floral', peony: 'floral',
  'lily-of-the-valley': 'floral', lily: 'floral', magnolia: 'floral',
  tuberose: 'floral', freesia: 'floral', carnation: 'floral', orchid: 'floral',
  geranium: 'floral', mimosa: 'floral', lotus: 'floral', waterlily: 'floral',
  'cherry-blossom': 'floral', hibiscus: 'floral',

  // Green / Herbal
  lavender: 'green', sage: 'green', basil: 'green', rosemary: 'green',
  thyme: 'green', mint: 'green', eucalyptus: 'green', fern: 'green',
  grass: 'green', 'green-tea': 'green', ivy: 'green', hemp: 'green',
  bamboo: 'green', 'fig-leaf': 'green',

  // Spicy
  'pink-pepper': 'spicy', 'black-pepper': 'spicy', cardamom: 'spicy',
  cinnamon: 'spicy', clove: 'spicy', nutmeg: 'spicy', ginger: 'spicy',
  saffron: 'spicy', coriander: 'spicy', cumin: 'spicy', 'star-anise': 'spicy',

  // Woody
  sandalwood: 'woody', cedar: 'woody', patchouli: 'woody', vetiver: 'woody',
  'guaiac-wood': 'woody', cypress: 'woody', pine: 'woody', juniper: 'woody',
  birch: 'woody', rosewood: 'woody', teak: 'woody', ebony: 'woody',
  driftwood: 'woody', oud: 'woody',

  // Resinous
  amber: 'resinous', ambergris: 'resinous', benzoin: 'resinous',
  frankincense: 'resinous', incense: 'resinous', labdanum: 'resinous',
  myrrh: 'resinous',

  // Musk / Animalic
  musk: 'musk', 'white-musk': 'musk', cashmere: 'musk', castoreum: 'musk',
  leather: 'musk', suede: 'musk',

  // Gourmand
  vanilla: 'gourmand', 'tonka-bean': 'gourmand', caramel: 'gourmand',
  chocolate: 'gourmand', cocoa: 'gourmand', coffee: 'gourmand',
  honey: 'gourmand', praline: 'gourmand', almond: 'gourmand',
  sugar: 'gourmand', rum: 'gourmand',

  // Fruity
  apple: 'fruity', peach: 'fruity', pear: 'fruity', plum: 'fruity',
  fig: 'fruity', cherry: 'fruity', raspberry: 'fruity', strawberry: 'fruity',
  'black-currant': 'fruity', lychee: 'fruity', mango: 'fruity',
  pineapple: 'fruity', coconut: 'fruity', 'passion-fruit': 'fruity',
  pomegranate: 'fruity',

  // Aquatic
  'sea-salt': 'aquatic', 'sea-crystal': 'aquatic', 'water-drop': 'aquatic',
  rain: 'aquatic', cloud: 'aquatic', wind: 'aquatic',

  // Powdery
  powder: 'powdery', talc: 'powdery', cotton: 'powdery', silk: 'powdery',

  // Earthy
  smoke: 'earthy', tobacco: 'earthy', charcoal: 'earthy', earth: 'earthy',
  moss: 'earthy', 'oak-moss': 'earthy', peat: 'earthy', mushroom: 'earthy',
}

/** Family colour palette — subtle tints for chip backgrounds */
export const FAMILY_COLORS: Record<NoteFamily, { bg: string; text: string; border: string }> = {
  citrus:   { bg: 'rgba(229, 194, 118, 0.12)', text: '#e5c276', border: 'rgba(229, 194, 118, 0.25)' },
  floral:   { bg: 'rgba(206, 147, 170, 0.12)', text: '#d4a0b5', border: 'rgba(206, 147, 170, 0.25)' },
  woody:    { bg: 'rgba(160, 120, 80, 0.12)',  text: '#b8956a', border: 'rgba(160, 120, 80, 0.25)' },
  spicy:    { bg: 'rgba(200, 100, 60, 0.12)',  text: '#d08050', border: 'rgba(200, 100, 60, 0.25)' },
  resinous: { bg: 'rgba(180, 140, 90, 0.12)',  text: '#c4a060', border: 'rgba(180, 140, 90, 0.25)' },
  musk:     { bg: 'rgba(170, 155, 140, 0.12)', text: '#b8a898', border: 'rgba(170, 155, 140, 0.25)' },
  gourmand: { bg: 'rgba(190, 140, 100, 0.12)', text: '#c89870', border: 'rgba(190, 140, 100, 0.25)' },
  fruity:   { bg: 'rgba(220, 120, 130, 0.12)', text: '#e09098', border: 'rgba(220, 120, 130, 0.25)' },
  green:    { bg: 'rgba(107, 143, 113, 0.12)', text: '#8bb890', border: 'rgba(107, 143, 113, 0.25)' },
  aquatic:  { bg: 'rgba(100, 160, 200, 0.12)', text: '#80b8d0', border: 'rgba(100, 160, 200, 0.25)' },
  earthy:   { bg: 'rgba(140, 120, 100, 0.12)', text: '#a09080', border: 'rgba(140, 120, 100, 0.25)' },
  powdery:  { bg: 'rgba(200, 190, 180, 0.12)', text: '#c8c0b8', border: 'rgba(200, 190, 180, 0.25)' },
}

export function getNoteFamily(noteName: string): NoteFamily {
  const icon = getNoteIcon(noteName)
  return ICON_TO_FAMILY[icon] ?? 'earthy'
}

export function getNoteFamilyColors(noteName: string) {
  return FAMILY_COLORS[getNoteFamily(noteName)]
}
