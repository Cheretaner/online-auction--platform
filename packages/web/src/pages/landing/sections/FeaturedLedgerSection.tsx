import { SectionHeading } from '../components/SectionHeading'
import { lotImage, recentDisposals } from '../landing.data'

export function FeaturedLedgerSection() {
  return (
    <section className="section muted-surface">
      <div className="container stack gap-xl">
        <SectionHeading
          eyebrow="Public Clearance Ledger"
          title="Active Disposals &amp; Benchmark Adjudications"
          description="Full transparency on valuations, reserve clearances, and winning bids recorded in Ethiopian Birr (ETB)."
          action={
            <a href="#" className="ledger-link">
              Access Full Public Audit Ledger
              <span className="material-symbols-outlined">open_in_new</span>
            </a>
          }
          compact
        />

        <div className="featured-auction">
          <div className="featured-copy">
            <div className="featured-tags">
              <span className="chip success">STATUTORY DISPOSAL #ETH-2025-0914</span>
              <span className="chip muted">Ministry of Transport &amp; Logistics</span>
            </div>
            <h3>42-Unit Caterpillar Earthmoving &amp; Excavator Fleet Liquidation</h3>
            <p>
              Surplus sovereign construction equipment from the Federal Expressway Extension Package III. Full mechanical inspection
              records, customs duty release documentation, and engine hour logs authenticated by FPPA Technical Evaluation Board.
            </p>

            <div className="value-grid">
              <div>
                <span>Adjudicated Value</span>
                <strong>ETB 188,200,000</strong>
                <small>Verified CPO Settled</small>
              </div>
              <div>
                <span>Reserve Ratio</span>
                <strong>114.2%</strong>
                <small>+ETB 23.4M above base</small>
              </div>
              <div>
                <span>Audit Validation</span>
                <strong className="success-text">SHA-256 Valid</strong>
                <small>Slip #FDRE-99214</small>
              </div>
            </div>

            <div className="featured-foot">
              <div className="location-chip">
                <span className="material-symbols-outlined">verified</span>
                Yard Location: Kality Mechanical Logistics Base, Addis Ababa
              </div>
              <a href="#" className="secondary-action small">
                <span className="material-symbols-outlined">file_download</span>
                Audit Slip &amp; Title Certificate
              </a>
            </div>
          </div>

          <div className="featured-image">
            <img src={lotImage} alt="Caterpillar heavy construction excavators arranged neatly in an industrial procurement yard in Addis Ababa" />
            <div className="lot-label">LOT 12-42 / KALITY INDUSTRIAL COMPOUND</div>
          </div>
        </div>

        <div className="ledger-table-wrap">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>Disposal Reference</th>
                <th>Procuring Entity</th>
                <th>Asset Category</th>
                <th className="align-right">Value / Base Reserve</th>
                <th className="align-center">Status</th>
                <th className="align-right">Civic Ledger Log</th>
              </tr>
            </thead>
            <tbody>
              {recentDisposals.map((row) => (
                <tr key={row.ref}>
                  <td className="mono strong">{row.ref}</td>
                  <td>
                    <span className="strong-text">{row.entity}</span>
                    <span className="subline">{row.detail}</span>
                  </td>
                  <td>{row.category}</td>
                  <td className="align-right mono strong">{row.value}</td>
                  <td className="align-center">
                    <span className={`status-pill ${row.statusTone}`}>{row.status}</span>
                  </td>
                  <td className="align-right mono log-value">{row.log}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
