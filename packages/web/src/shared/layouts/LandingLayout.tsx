import type { ReactNode } from 'react'

import { HeaderNav } from '../../pages/landing/sections/HeaderNav'
import { SiteFooter } from '../../pages/landing/sections/SiteFooter'

type LandingLayoutProps = {
  children: ReactNode
  footer?: ReactNode
}

export function LandingLayout({ children, footer }: LandingLayoutProps) {
  return (
    <div className="landing-shell">
      <HeaderNav />
      {children}
      {footer ?? <SiteFooter />}
    </div>
  )
}