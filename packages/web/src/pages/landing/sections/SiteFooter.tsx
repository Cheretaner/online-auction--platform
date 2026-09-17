import { BrandLockup } from '../components/BrandLockup'
import { footerColumns } from '../landing.data'
import type { ReactNode } from 'react'

type SiteFooterProps = {
  children?: ReactNode
}

export function SiteFooter({ children }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      {children ? <div className="footer-cta-shell">{children}</div> : null}

      <div className="footer-main-shell">
        <div className="container footer-grid">
          <div className="footer-brand">
            <div className="footer-lockup">
              <BrandLockup compact />
            </div>
            <p>
              Federal Democratic Republic of Ethiopia statutory central auction repository. Providing cryptographically verifiable
              tender clearances, electronic CPO settlement, and institutional liquidation architecture under FPPA Directives.
            </p>
            <div className="footer-chips">
              <span className="chip muted">ISO/IEC 27001</span>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title} className="footer-column">
              <h3>{column.title}</h3>
              <ul>
                {column.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="container footer-bottom">
          <div>
            <span>© 2026 Cheretanet FDRE. All sovereign rights reserved.</span>
            <span>Statutory Act No. 649/2009 Compliant</span>
          </div>
          <div className="footer-bottom-links">
            <a href="#">Public Audit Log</a>
            <a href="#">CPO Verification Standard</a>
            <span>SHA-256 Ledger ID: 0x9f4a...21d0</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
