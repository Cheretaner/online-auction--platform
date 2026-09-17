import { heroImage, telemetry } from '../landing.data'

export function HeroSection() {
  return (
    <section className="hero-wrap">
      <div className="container">
        <div className="ticker-strip">
          <div className="ticker-left">
            <span className="ticker-entity">
              <span className="material-symbols-outlined">assured_workload</span>
              FEDERAL STATUTE GAZETTE VOL. 31/88
            </span>
            <span className="ticker-divider">|</span>
            <span className="ticker-copy">GATEWAY ETH-FPPA-DIR-2024.08 COMPLIANT</span>
          </div>
          <div className="ticker-right">
            <span className="live-dot" />
            <span>PUBLIC LEDGER: SYNCHRONIZED</span>
            <span className="ticker-divider">|</span>
            <span>ADDIS ABABA SEED: 0x8F9C...110B</span>
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <div className="hero-kickers">
              <span className="chip muted">Statutory Platform No. 649/2009</span>
              <span className="chip success">FDRE Ministry of Finance Certified</span>
            </div>

            <h1>The National Infrastructure for Verifiable Institutional Auctions &amp; Public Procurement.</h1>

            <p className="hero-lead">
              Federal ministries, regional states, and sovereign commercial enterprises conduct legally binding public tender
              clearances, high-value asset disposals, and automated CPO settlements under the direct regulatory oversight of the
              Federal Public Procurement Authority.
            </p>

            <div className="hero-actions">
              <a href="#" className="primary-action large">
                Explore Active Public Tenders
                <span className="material-symbols-outlined">arrow_forward</span>
              </a>
              <a href="#" className="secondary-action large">
                <span className="material-symbols-outlined">verified_user</span>
                Download Bidder Directive 2025
              </a>
            </div>

            <div className="telemetry-grid">
              {telemetry.map((item) => (
                <article key={item.label} className="telemetry-card">
                  <div className="telemetry-label">{item.label}</div>
                  <div className="telemetry-value">{item.value}</div>
                  <div className="telemetry-meta">{item.meta}</div>
                </article>
              ))}
            </div>
          </div>

          <aside className="hero-visual">
            <div className="hero-image-frame">
              <img src={heroImage} alt="Federal Ministry of Finance and Procurement Headquarters in Addis Ababa" />
              <div className="hero-image-label">
                <span className="material-symbols-outlined">account_balance</span>
                CENTRAL REGISTRY REG-ET-001
              </div>
              <div className="hero-image-gps">GPS: 9.0182° N, 38.7490° E</div>
            </div>
            <div className="hero-image-caption">
              <div className="caption-top">
                <span className="caption-title">Sovereign Authority Venue</span>
                <span className="caption-side">ARADA SUB-CITY</span>
              </div>
              <p>
                All tender envelopes, digital token clearances, and CPO releases are cryptographically anchored at the Federal Public
                Procurement and Property Administration Agency datacenter in Addis Ababa.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}
