import { SectionHeading } from '../components/SectionHeading'
import { pillars } from '../landing.data'

export function TrustFrameworkSection() {
  return (
    <section className="section muted-surface">
      <div className="container stack gap-xl">
        <SectionHeading
          eyebrow="Statutory Architecture"
          title="The Three-Pillar Trust &amp; Integrity Framework"
          description="Engineered exclusively for high-stakes enterprise liquidation and public assets. No phantom bidders, no collusion, and total legal recourse under Ethiopian judicial precedent."
          action={
            <div className="policy-chip">
              <span className="material-symbols-outlined">verified</span>
              Strict Adherence: FPPA Directive No. 42/2021
            </div>
          }
        />

        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article key={pillar.id} className="pillar-card">
              <div className="pillar-icon">
                <span className="material-symbols-outlined">{pillar.icon}</span>
              </div>
              <div className="pillar-topline">
                <span className="eyebrow small">{pillar.eyebrow}</span>
                <span className="mini-chip">{pillar.tag}</span>
              </div>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
              <div className="pillar-footer">
                <div className="mini-label-row">
                  <span>{pillar.footerLabel}</span>
                  <strong>{pillar.footerValue}</strong>
                </div>
                <p>{pillar.footerText}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
