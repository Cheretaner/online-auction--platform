import '../../App.css'
import { CtaBand } from './sections/CtaBand'
import { FeaturedLedgerSection } from './sections/FeaturedLedgerSection'
import { HeroSection } from './sections/HeroSection'
import { PartnerGridSection } from './sections/PartnerGridSection'
import { SiteFooter } from './sections/SiteFooter'
import { StepsSection } from './sections/StepsSection'
import { TrustFrameworkSection } from './sections/TrustFrameworkSection'
import { LandingLayout } from '../../shared/layouts/LandingLayout'

export function LandingPage() {
  return (
    <LandingLayout footer={<SiteFooter>{<CtaBand />}</SiteFooter>}>
      <main className="page-main">
        <HeroSection />
        <section className="bridge-band">
          <div className="container bridge-inner">
            <div className="bridge-status">
              <span className="live-dot pulse" />
              <span className="bridge-label">LIVE SETTLEMENT BRIDGE</span>
              <span className="bridge-copy">CBE EthSwitch Gateway v3.12: Operational</span>
            </div>
            <div className="bridge-metrics">
              <div>
                <span>Active Bids (24h):</span>
                <strong>1,842 Encrypted Submissions</strong>
              </div>
              <div>
                <span>Average CPO Retention:</span>
                <strong className="accent">4.8 Days (Statutory min: 3d)</strong>
              </div>
              <div className="sparkline-wrap">
                <span>Velocity:</span>
                <svg viewBox="0 0 100 20" className="sparkline" fill="none" aria-hidden="true">
                  <path d="M0 16 L15 14 L30 17 L45 8 L60 11 L75 5 L90 7 L100 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </section>
        <TrustFrameworkSection />
        <StepsSection />
        <FeaturedLedgerSection />
        <PartnerGridSection />
      </main>
    </LandingLayout>
  )
}
