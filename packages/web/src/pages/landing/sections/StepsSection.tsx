import { SectionHeading } from '../components/SectionHeading'
import { steps } from '../landing.data'

export function StepsSection() {
  return (
    <section className="section">
      <div className="container stack gap-xl">
        <SectionHeading
          eyebrow="Operational Directive"
          title="How Sovereign Participation Works"
          description="Four standardized statutory checkpoints required for all participating enterprises, international EPC contractors, and sovereign disposing authorities."
        />

        <div className="step-grid">
          {steps.map((step) => (
            <article key={step.id} className="step-card">
              <div className="step-head">
                <span className="step-number">{step.id}</span>
                <span className="step-stage">{step.stage}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              <div className="step-foot">
                <span className="material-symbols-outlined">{step.footerIcon}</span>
                <strong>{step.footer}</strong>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
