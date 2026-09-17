import { SectionHeading } from '../components/SectionHeading'
import { partners } from '../landing.data'

export function PartnerGridSection() {
  return (
    <section className="section">
      <div className="container stack gap-lg">
        <SectionHeading
          eyebrow="Sovereign Oversight &amp; Interbank Clearing Consortium"
          title="Institutional Trust Network"
          compact
          action={<span className="policy-chip muted-chip">Statutory Joint Protocol FDRE-NBE-FPPA-2024</span>}
        />

        <div className="partner-grid">
          {partners.map((partner) => (
            <article key={partner.name} className="partner-card">
              <div className={`partner-top ${partner.tone}`}>
                <span className="material-symbols-outlined">{partner.icon}</span>
                <strong>{partner.name}</strong>
              </div>
              <h3>{partner.title}</h3>
              <p>{partner.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
