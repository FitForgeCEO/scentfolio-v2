interface IconProps {
  name: string
  filled?: boolean
  className?: string
  size?: number
}

export function Icon({ name, filled = false, className = '', size }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'fill' : ''} ${className}`}
      style={size ? { fontSize: size } : undefined}
    >
      {name}
    </span>
  )
}
