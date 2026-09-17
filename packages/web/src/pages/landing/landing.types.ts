export type TelemetryItem = {
  label: string
  value: string
  meta: string
}

export type PillarItem = {
  id: string
  title: string
  tag: string
  eyebrow: string
  icon: string
  description: string
  footerLabel: string
  footerValue: string
  footerText: string
}

export type StepItem = {
  id: string
  stage: string
  title: string
  body: string
  footerIcon: string
  footer: string
}

export type DisposalItem = {
  ref: string
  entity: string
  detail: string
  category: string
  value: string
  status: string
  statusTone: 'sealed' | 'live' | 'closed'
  log: string
}

export type PartnerItem = {
  icon: string
  name: string
  title: string
  body: string
  tone: 'primary' | 'secondary' | 'danger'
}

export type FooterColumn = {
  title: string
  items: string[]
}
