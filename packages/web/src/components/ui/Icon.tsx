type IconProps = {
  src: string
  width: number
  height: number
  className?: string
}

/** Decorative SVG icon rendered at the exact size it has in the Figma design. */
export function Icon({ src, width, height, className = '' }: IconProps) {
  return (
    <img
      src={src}
      alt=""
      style={{ width, height }}
      className={`block max-w-none shrink-0 ${className}`}
    />
  )
}
