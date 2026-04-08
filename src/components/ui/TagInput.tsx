import { useState, useRef, useCallback } from 'react'
import { Icon } from './Icon'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  maxTags?: number
  label?: string
}

const TAG_COLOURS = [
  'bg-primary/10 text-primary',
  'bg-amber-500/10 text-amber-400',
  'bg-emerald-500/10 text-emerald-400',
  'bg-blue-500/10 text-blue-400',
  'bg-pink-500/10 text-pink-400',
  'bg-purple-500/10 text-purple-400',
  'bg-orange-500/10 text-orange-400',
  'bg-cyan-500/10 text-cyan-400',
]

function tagColour(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length]
}

export function TagInput({ tags, onChange, suggestions = [], placeholder = 'Add tag...', maxTags = 20, label }: TagInputProps) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = useCallback((tag: string) => {
    const normalised = tag.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').slice(0, 30)
    if (!normalised || tags.includes(normalised) || tags.length >= maxTags) return
    onChange([...tags, normalised])
    setInput('')
    setShowSuggestions(false)
  }, [tags, onChange, maxTags])

  const removeTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }, [tags, onChange])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (input.trim()) addTag(input)
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  // Filter suggestions to exclude already-added tags
  const filteredSuggestions = suggestions
    .filter((s) => !tags.includes(s) && s.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="space-y-2">
      {label && <p className="text-[10px] uppercase tracking-[0.15em] font-label text-secondary/60">{label}</p>}

      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${tagColour(tag)}`}
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-black/10 transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <div className="flex items-center bg-surface-container rounded-xl px-3 py-2.5 focus-within:ring-1 ring-primary/30 transition-all">
          <Icon name="label" className="text-secondary/40 mr-2" size={16} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={tags.length >= maxTags ? `Max ${maxTags} tags` : placeholder}
            disabled={tags.length >= maxTags}
            className="bg-transparent border-none p-0 focus:ring-0 focus:outline-none text-on-surface placeholder:text-secondary/30 w-full text-xs"
            maxLength={30}
          />
          {input && (
            <button
              onClick={() => addTag(input)}
              className="text-primary text-[10px] font-bold uppercase tracking-wider flex-shrink-0 active:scale-95"
            >
              ADD
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface-container-highest rounded-xl py-1 shadow-xl border border-outline-variant/10 z-[var(--z-dropdown)] max-h-[160px] overflow-y-auto">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                onMouseDown={(e) => { e.preventDefault(); addTag(s) }}
                className="w-full text-left px-3 py-2 text-xs text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2"
              >
                <Icon name="add" size={14} className="text-primary/50" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-[9px] text-secondary/30">{tags.length}/{maxTags} tags · Press Enter or comma to add</p>
    </div>
  )
}

export { tagColour }
