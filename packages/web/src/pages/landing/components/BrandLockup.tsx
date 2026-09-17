import { logoImage } from '../landing.data'

type BrandLockupProps = {
  compact?: boolean
}

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className="brand-lockup">
      <img src={logoImage} alt="Cheretanet logo" className="brand-mark" />
      <div>
        <div className="brand-wordmark">CHERETANET</div>
        <div className="brand-tagline">
          {compact ? 'Procurement Registry' : 'National Procurement Registry'}
        </div>
      </div>
    </div>
  )
}
