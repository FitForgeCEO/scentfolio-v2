interface IconProps {
  name: string
  filled?: boolean
  className?: string
  size?: number
  style?: React.CSSProperties
}

export function Icon({ name, filled = false, className = '', size, style }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'fill' : ''} ${className}`}
      style={{ ...(size ? { fontSize: size } : {}), ...style }}
    >
      {name}
    </span>
  )
}
