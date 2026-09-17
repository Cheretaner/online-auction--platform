import type {
  DisposalItem,
  FooterColumn,
  PartnerItem,
  PillarItem,
  StepItem,
  TelemetryItem,
} from './landing.types'

export const heroImage =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBfTS6an8mexnt5wnfNCq_mPQ1uU5JIX-e-yV4sH2XenG_23aT2gmwTTRB5Z2IaDzg6jajUeD_KEAOahBHXEYFd5gBUnEf7KXwaQko93_FSOzWT-7W4NP0Br2iq_YUVZZpS12ur1-RJZ4G8pkvrpycXhxdMubykLuUyQSWnmnn3LX29efWL4kvuQARHrTPoZzmM_33euV4VqSc4Epb8D9_ZCL9KbKdfKhLxyz3qlBMF__GyFMHdgkzd'

export const logoImage =
  'https://lh3.googleusercontent.com/aida/AEtjO1UNpIPkfhCYUJxcMJ8xD9-BRfzCWzZVJywyDRMu7NhaKv6j3koPMRX0rWr-nQWosRYJCcEhPCww7dXGcYkg1YdfnDQluYozOVXqjtacV_FwOD_mZ4d4_s2xOx8x6-GqipPgSrfXveByaZRrEvMvdbitI7EZDb4MGundvXKPcS9q_OxUn_d4Sq6CNj6ysxGgxd_qvwbqRXJJuQXngMKqbpCAcNIOujr5TRtXciZUbYweVNbs7gOf-FoLO18'

export const lotImage = 'https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg'

export const telemetry: TelemetryItem[] = [
  { label: 'Active Disposals Value', value: 'ETB 1.42B', meta: '12 New This Week' },
  { label: 'Statutory Issuers', value: '84 Entities', meta: 'Ministries & SOEs' },
  { label: 'Escrow Settlement', value: '100% CPO', meta: 'Commercial Bank ETH' },
  { label: 'Civic Audit State', value: 'Zero Delta', meta: 'Audited Daily' },
]

export const pillars: PillarItem[] = [
  {
    id: '01',
    title: 'Sovereign Escrow & CBE CPO Guarantee',
    tag: '5% Mandatory',
    eyebrow: 'Pillar 01 / Liquidity Guarantee',
    icon: 'account_balance_wallet',
    description:
      'Every submitted bid requires an authenticated Cashier\'s Payment Order verified in real time. Unbacked bids are rejected before they enter the engine.',
    footerLabel: 'Automatic Escrow Release',
    footerValue: 'T+24 Hours',
    footerText:
      'Non-winning bidder funds are released back to issuer accounts without administrative friction.',
  },
  {
    id: '02',
    title: 'AI-Assisted Document & Asset Intelligence',
    tag: 'OCR + AI-Audit',
    eyebrow: 'Pillar 02 / Due Diligence',
    icon: 'document_scanner',
    description:
      'Automated extraction of specifications, tax clearance, and customs documents helps officers surface discrepancies before publication.',
    footerLabel: 'Tax Verification Sync',
    footerValue: 'Live MoR API',
    footerText:
      'Direct telemetry handshake prevents forged tax stamps and expired trade certificates.',
  },
  {
    id: '03',
    title: 'Public Audit Ledger & Anti-Collusion Oversight',
    tag: 'SHA-256 Immutable',
    eyebrow: 'Pillar 03 / Zero Discretion',
    icon: 'policy',
    description:
      'Each bid, timestamped extension, and evaluation matrix is written to a cryptographic public hash log for civic inspection.',
    footerLabel: 'Civic Access Node',
    footerValue: 'Open Ledger',
    footerText:
      'Journalists, researchers, and competing bidders can audit timestamp chronologies anonymously.',
  },
]

export const steps: StepItem[] = [
  {
    id: '01',
    stage: 'Stage I',
    title: 'Institutional Verification',
    body: 'Submit renewed trade license, TIN, VAT certification, and supplier registry serial key.',
    footerIcon: 'domain_verification',
    footer: 'Turnaround: 30 Mins (Automated)',
  },
  {
    id: '02',
    stage: 'Stage II',
    title: 'CPO Bond Lodgement',
    body: 'Deposit the bid security bond through verified CBE CPO clearing or certified merchant branch.',
    footerIcon: 'lock',
    footer: 'Cryptographically Bound Escrow',
  },
  {
    id: '03',
    stage: 'Stage III',
    title: 'Digital Sealed Bidding',
    body: 'Submit encrypted proposals or join live ascending auctions with automatic anti-sniping extensions.',
    footerIcon: 'security',
    footer: 'Zero Visibility Until Opening Clock',
  },
  {
    id: '04',
    stage: 'Stage IV',
    title: 'Title Conveyance & Settlement',
    body: 'After adjudication, settlement is executed, bonds are returned, and asset release is gazetted.',
    footerIcon: 'assignment_turned_in',
    footer: 'Immediate Property Title Release',
  },
]

export const recentDisposals: DisposalItem[] = [
  {
    ref: 'EEP-HV-SUB-098',
    entity: 'Ethiopian Electric Power (EEP)',
    detail: 'Gelan Substation Expansion Surplus',
    category: 'Industrial Switchgear & High-Tension Copper',
    value: 'ETB 490,000,000',
    status: 'Sealed Evaluation',
    statusTone: 'sealed',
    log: '0x71D4...BA09',
  },
  {
    ref: 'MAA-LOG-RTG-2025',
    entity: 'Ethiopian Maritime Affairs Authority',
    detail: 'Modjo Dry Port Modernization',
    category: 'Port Rail Container Gantry Cranes (3 Units)',
    value: 'ETB 650,000,000',
    status: 'Live Bidding Open',
    statusTone: 'live',
    log: '0x3C89...9942',
  },
  {
    ref: 'ETH-TEL-FBR-004',
    entity: 'Ethio Telecom Infrastructure Div.',
    detail: 'Debre Zeit Warehousing Facility',
    category: 'Decommissioned Optical Fiber & Towers (480 MT)',
    value: 'ETB 84,300,000',
    status: 'Completed & Concluded',
    statusTone: 'closed',
    log: '0x4A18...03D1',
  },
]

export const partners: PartnerItem[] = [
  {
    icon: 'gavel',
    name: 'FPPA',
    title: 'Federal Public Procurement Agency',
    body: 'Sole statutory regulator of public bidding thresholds and procedural compliance.',
    tone: 'primary',
  },
  {
    icon: 'account_balance',
    name: 'CBE',
    title: 'Commercial Bank of Ethiopia',
    body: 'Direct institutional host for bidder CPO validation and escrow settlement.',
    tone: 'secondary',
  },
  {
    icon: 'terminal',
    name: 'MInT',
    title: 'Ministry of Innovation & Tech',
    body: 'National Data Center cryptographic key custody and sovereign cloud compliance.',
    tone: 'primary',
  },
  {
    icon: 'shield',
    name: 'FEACC',
    title: 'Federal Ethics & Anti-Corruption',
    body: 'Autonomous statutory watchdog with direct live inspection terminals.',
    tone: 'danger',
  },
]

export const footerColumns: FooterColumn[] = [
  {
    title: 'Statutory Oversight',
    items: [
      'Federal Public Procurement Authority',
      'Ministry of Finance (FDRE)',
      'Federal Ethics & Anti-Corruption Commission',
      'National Bank of Ethiopia',
    ],
  },
  {
    title: 'Settlement Partners',
    items: [
      'Commercial Bank of Ethiopia (CBE)',
      'Dashen Bank CPO Portal',
      'Awash Bank Escrow Service',
      'EthSwitch Interbank Clearing',
    ],
  },
  {
    title: 'Direct Civic Support',
    items: [
      'Procurement Helpdesk: 8090',
      'Arada Sub-City, Addis Ababa',
      'support@chereta.gov.et',
      'audit-ledger@fppa.gov.et',
    ],
  },
]
