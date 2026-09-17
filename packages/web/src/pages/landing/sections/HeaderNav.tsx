import { BrandLockup } from '../components/BrandLockup'

export function HeaderNav() {
  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="container utility-inner">
          <div className="utility-left">
            <span className="utility-verified">
              <span className="material-symbols-outlined">verified</span>
              Certified by Federal Public Procurement Authority - FPPA
            </span>
            <span className="utility-divider">|</span>
            <span className="utility-clock">
              <span className="material-symbols-outlined">schedule</span>
              ADDIS ABABA (EAT 17:15)
            </span>
          </div>
          <div className="utility-right">
            <span className="utility-support">
              <span className="material-symbols-outlined">support_agent</span>
              Hotline: 8090
            </span>
            <span className="utility-divider">|</span>
            <span className="utility-lang">
              <span className="material-symbols-outlined">language</span>
              EN / አማርኛ
            </span>
          </div>
        </div>
      </div>

      <div className="container nav-row">
        <BrandLockup />

        <nav className="site-nav" aria-label="Primary">
          {['Public Tenders', 'How It Works', 'Trust & Verification', 'Institutional Issuers', 'Public Audit Ledger'].map(
            (item, index) => (
              <a href="#" key={item} className={index === 0 ? 'active' : ''}>
                {item}
              </a>
            ),
          )}
        </nav>

        <div className="nav-actions">
          <a href="#" className="ghost-action hidden-sm">
            <span className="material-symbols-outlined">shield</span>
            Verify CPO Bond / Licensure
          </a>
          <a href="#" className="primary-action">
            Register as Bidder
          </a>
          <button type="button" className="profile-chip" aria-label="Profile">
            <span className="material-symbols-outlined">person</span>
          </button>
        </div>
      </div>
    </header>
  )
}
