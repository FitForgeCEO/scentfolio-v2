import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  /** Tailwind classes for the container wrapper */
  wrapperClassName?: string
  /** Aspect ratio hint for layout stability (e.g. 'aspect-[3/4]') */
  aspect?: string
}

/**
 * Lazy-loaded image with IntersectionObserver, shimmer placeholder,
 * and smooth fade-in. Prevents layout shift with optional aspect ratio.
 */
export function LazyImage({ src, alt, className = '', wrapperClassName = '', aspect }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const [error, setError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${aspect ?? ''} ${wrapperClassName}`}>
      {/* Placeholder — shimmer with subtle gradient */}
      {!loaded && (
        <div
          className="absolute inset-0 shimmer"
          style={{
            background: error
              ? 'var(--color-surface-container)'
              : undefined,
          }}
        />
      )}
      {inView && !error && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          loading="lazy"
          decoding="async"
        />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
          <span className="material-symbols-outlined text-secondary/20" style={{ fontSize: 24 }}>
            water_drop
          </span>
        </div>
      )}
    </div>
  )
}
