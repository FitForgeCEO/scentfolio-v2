import { useState, useRef, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  /** Tailwind classes for the container wrapper */
  wrapperClassName?: string
}

/**
 * Lazy-loaded image with a shimmer/blur placeholder.
 * Uses IntersectionObserver for viewport-based loading
 * and CSS transition for a smooth fade-in.
 */
export function LazyImage({ src, alt, className = '', wrapperClassName = '' }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
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
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${wrapperClassName}`}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div className="absolute inset-0 bg-surface-container animate-pulse" />
      )}
      {inView && (
        <img
          src={src}
          alt={alt}
          className={`transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
          onLoad={() => setLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  )
}
