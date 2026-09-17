import type { ReactNode } from 'react'

type SectionHeadingProps = {
  eyebrow: string
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: SectionHeadingProps) {
  return (
    <div className={`section-heading${compact ? ' compact' : ''}${action ? ' split-heading' : ''}`}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? action : null}
    </div>
  )
}
