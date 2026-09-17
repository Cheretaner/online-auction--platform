# AI-Powered Transparent Online Auction System

**General Description and Functional Requirements**

*Extracted from the Software Requirements Specification, Chapter Two. This document
carries the platform overview and functional requirements FR1-FR20 only. Non-functional
requirements, constraints, use cases, scenarios, and the system design are in the full SRS.*

---

## 1. General Description

### 1.1 Purpose

The platform is a secure, transparent online auction system through which government
institutions and large private organizations publish assets and tenders, and verified
individuals and businesses bid through a process that can be audited by anyone. It exists
to replace a manual procedure whose weaknesses are structural rather than incidental:
participation limited by physical proximity, a paper record that cannot prove it was not
rewritten, collusive patterns that are invisible within a single auction file, tabulation
that takes weeks and introduces errors in the amount, and outcomes that are never published.

**Value proposition:** making auctions transparent, accessible, auditable, and intelligent.

### 1.2 Scope

**In scope.** Auction publication and discovery, bidder verification, deposit registration,
real-time open ascending bidding, sealed-bid tendering, automatic closing and winner
determination, an append-only audit ledger, AI categorization, AI anomaly screening, a
grounded document assistant, notifications, dashboards, and dispute handling.

**Out of scope.** Payment settlement and the movement of money, automated national identity
or taxpayer verification, a distributed or public blockchain, post-award logistics, and
automated enforcement of any kind. Dutch auctions, reverse procurement auctions, and
attended hall auctions are deferred to later phases.

### 1.3 Product Perspective

The proposed system is a web-based auction platform composed of a React and TypeScript
client, an Express and TypeScript service layer, and Supabase as the managed data platform
providing PostgreSQL, authentication, object storage, and real-time channels. Organizations
publish auctions through a controlled workflow; verified bidders participate remotely; the
server validates and records every bid atomically; and all state changes are appended to a
hash-chained audit ledger.

Three AI capabilities are layered on the transactional core. A categorization service
classifies listed items into a controlled taxonomy so that listings are searchable without
manual tagging. An anomaly detection service computes behavioural features over the bid
ledger and raises scored flags with explanations for human review. An assistant summarises
auction documents and answers procedural questions grounded in the published auction record.
All three are advisory; none of them takes a consequential action autonomously.

### 1.4 User Classes

| Role | Description |
|---|---|
| Guest | Any unauthenticated visitor. Browses, searches, views published results, and verifies the audit chain of a completed auction |
| Bidder | A verified individual or business. Registers deposits, bids, withdraws with a reason, uses the assistant, raises disputes |
| Auction Officer | Institutional staff. Creates auctions and items, uploads documents, confirms AI categories, verifies deposits, publishes results |
| Organization Administrator | Assigns organizational roles, approves auctions created by others, decides on failed reserves, views organizational dashboards |
| Compliance Officer | Reviews anomaly flags, escalates or dismisses with justification, suspends an auction pending investigation, handles disputes, exports audit chains |
| Platform Administrator | Onboards organizations, manages the taxonomy and anomaly rules, runs integrity checks across organizations |
| AI Service | A non-human actor. Classifies items, computes features, raises flags, generates explanations and summaries. Changes no state and applies no penalty |
| Scheduler | A non-human actor. Opens, extends, and closes auctions; triggers determination, reports, and reminders |

### 1.5 Operating Environment

- **Client:** any modern browser on desktop or mobile, including low-bandwidth connections
- **Server:** Node.js 20 service layer, deployed on managed free-tier infrastructure
- **Data:** PostgreSQL with row-level security, object storage for documents and media
- **External:** a language model provider behind an adapter interface, and a transactional mail provider; both are non-critical by design

### 1.6 Design Principles Governing the Requirements

1. **Every action that changes state is recorded**, in the same transaction as the action itself. An action that cannot be recorded does not take effect.
2. **The record is evidence, not a claim.** The audit ledger is append-only and hash-chained, and its integrity is verifiable by a third party.
3. **Authorization is enforced twice**, in the service layer and independently by database policies, so that an application defect alone cannot disclose a sealed bid.
4. **AI is advisory only.** No account is suspended and no auction cancelled by the system. The system produces evidence; a human decides.
5. **Bidding is correct under concurrency.** No lost bids, no duplicates, unambiguous ordering, no acceptance below the published minimum.

---

## 2. Functional Requirements

The functional requirements describe what the system must be able to do. Each requirement
below is stated as a set of testable capabilities.

### FR1. User Registration, Authentication, and Authorization

- Individuals and businesses can register with an e-mail address, a password, and a mobile number, and can authenticate securely thereafter.
- The system issues a signed session token carrying the user's role, and every protected operation is authorised against that role.
- The system supports the roles Guest, Bidder, Auction Officer, Organization Administrator, Compliance Officer, and Platform Administrator.
- Passwords are stored only in hashed form; sessions expire after a configured period; repeated failed authentication attempts are rate limited.
- Users can reset a forgotten password through a verified e-mail flow and can view and edit their own profile.

### FR2. Bidder Verification (KYC)

- A registered user must submit verification documents before being permitted to bid: a national identity document for an individual, or a business registration certificate and a taxpayer identification number for a business.
- The system records each submission with a status of pending, verified, or rejected, and stores the checksum of every uploaded document.
- A verification officer reviews the submission and records an approval or a rejection with a written reason.
- Only users whose verification status is verified may place bids; all other users may browse and search.
- Every verification decision is written to the audit trail with the identity of the deciding officer.

### FR3. Organization Onboarding and Role Management

- The platform administrator onboards an organization by recording its legal name, type, taxpayer identification number, region, and contact details.
- The organization administrator assigns and revokes the roles of auction officer, approver, and compliance officer for users belonging to that organization.
- A user may belong to at most one organization, and an organization user can act only on auctions belonging to that organization.
- All role assignments and revocations are recorded in the audit trail.

### FR4. Auction Creation and Publication

- An auction officer can create an auction containing one or more items, each with a title, description, condition, quantity, unit, and location.
- The officer specifies the auction type (open ascending or sealed bid), the starting price, the reserve price, the minimum bid increment, the required deposit, the eligibility criteria, the opening time, and the closing time.
- The officer can upload item images and supporting documents such as specifications, inspection reports, and terms and conditions.
- An auction moves through the states draft, pending review, scheduled, live, closed, under review, awarded, and cancelled; the transitions permitted from each state are enforced by the server.
- An auction becomes publicly visible only after an approver has reviewed and approved it.
- A scheduled auction opens automatically at its opening time and closes automatically at its closing time.
- Any modification to a published auction is versioned, is displayed to participants as an amendment notice, and is recorded in the audit trail.

### FR5. AI-Powered Item Categorization

- When an item is created, the system submits its title and description to the AI categorization service and receives a category from the controlled taxonomy together with a confidence value and a short rationale.
- The taxonomy covers vehicles, heavy machinery and construction equipment, real estate and land lease, electronics and information technology, agricultural equipment and produce, office furniture and supplies, industrial and spare parts, and other assets, each with sub-categories.
- A classification with a confidence value at or above the configured threshold is presented to the officer as a pre-selected suggestion; a classification below the threshold is routed to a manual categorization queue.
- The officer can always override the suggested category, and both the suggestion and the override are recorded.
- Categorization results are cached so that identical descriptions do not consume repeated model calls.

### FR6. Auction Search, Filtering, and Discovery

- Any visitor, with or without an account, can browse published auctions.
- Auctions can be filtered by category, sub-category, region and city, publishing organization, auction type, price range, status, and closing date, and these filters can be combined.
- Full-text search covers item titles and descriptions.
- Results can be sorted by closing time, publication time, starting price, current highest bid, or number of bids.
- A registered user can save a search and subscribe to notifications for new auctions that match it, and can add an auction to a personal watch list.

### FR7. Deposit Registration

- For an auction that requires a bid security, a bidder registers a deposit reference, such as a certified payment order number, together with the issuing bank, the amount, and a scanned copy.
- An officer verifies the deposit and marks it as verified, rejected, or released.
- A bidder may participate in such an auction only when a verified deposit exists for that auction.
- Deposits of unsuccessful bidders are marked for release when the auction reaches a final state.

### FR8. Real-Time Bidding

- A verified bidder with a verified deposit can submit a bid on a live open ascending auction.
- The server validates that the auction is live, that the bidder is eligible, that the bidder is not the publishing organization, and that the amount is at least the current highest bid plus the minimum increment.
- Bid submission is serialised per auction inside a database transaction, so that two simultaneous bids cannot both be accepted at the same amount and the recorded order is unambiguous.
- Each accepted bid is stored with its amount, the identity of the bidder, and a server-generated timestamp, and is appended to the audit trail.
- The updated highest bid, the bid count, and the remaining time are broadcast to all connected participants within seconds.
- The complete bid history of an open ascending auction is visible to participants with bidder identities pseudonymised until the auction closes.
- A rejected bid is reported to the bidder with the specific reason and does not create a bid record.

### FR9. Sealed-Bid Submission

- For a sealed-bid auction, a bidder submits a single offer that is not visible to any other participant, including the publishing organization, before the closing time.
- The system stores the commitment hash of the sealed offer at submission time so that the offer cannot be altered afterwards without detection.
- At the closing time all sealed bids are opened simultaneously by the system, ranked, and published to the participants.
- A bidder may replace a sealed bid before the deadline; each replacement is recorded as a separate event.

### FR10. Anti-Sniping Auction Extension

- If a valid bid is placed within the configured final window of an open ascending auction, the closing time is extended by the configured extension period.
- The number of automatic extensions is capped by a configurable maximum.
- Every extension is broadcast to participants in real time and recorded in the audit trail with the bid that triggered it.

### FR11. Bid Withdrawal

- A bidder may request withdrawal of a bid only before the auction closes and only with a stated reason.
- A withdrawal does not delete the original bid; it records a withdrawal event and marks the bid as withdrawn, after which the previous highest valid bid becomes current.
- Withdrawals are counted as a behavioural feature by the anomaly detection subsystem.

### FR12. AI Anomaly Detection

- The system continuously computes behavioural features over the bid ledger, including bid velocity, the distribution of bid increments, the proportion of bids placed in the final window, the co-occurrence of bidders across auctions, the frequency with which one account is repeatedly outbid by the same account, the ratio of withdrawals to bids, the age of an account relative to the value it bids, and the clustering of accounts by registration attributes and network origin.
- A deterministic scoring engine evaluates configurable rules over those features and produces a score from zero to one hundred with an associated severity of low, medium, or high.
- When a score reaches the configured threshold, the system raises an anomaly flag recording the rule codes triggered, the score, the evidence, and the affected auction and accounts.
- A language model generates a plain-language explanation of the flagged pattern for the reviewing officer; the explanation does not determine the score.
- Flags are advisory. The system never suspends an account, cancels an auction, or declares a participant fraudulent on the basis of a flag alone.
- The flagging of an auction that has closed with a high-severity unresolved flag places the auction in the under-review state until a compliance officer records a decision.

### FR13. Fraud and Account Integrity Monitoring

- The system detects and reports probable duplicate accounts using matching identity numbers, taxpayer identification numbers, telephone numbers, and device or network fingerprints.
- Unusual account activity such as bursts of registrations shortly before a high-value auction, or repeated failed verification attempts, is reported to administrators.
- Detected duplicates are reported for human investigation and are never merged or disabled automatically.

### FR14. Digital Audit Trail

- Every state-changing action is recorded as an audit event holding the actor, the action, the affected entity, a canonical JSON payload of the change, the server timestamp, the hash of the previous event in the chain, and its own hash.
- The recorded actions include at minimum: user registration, verification decisions, role assignment, organization onboarding, auction creation, modification, approval, publication, opening, extension, closing and cancellation, bid submission, bid withdrawal, sealed-bid opening, deposit verification, anomaly flag creation and resolution, winner determination, report generation, and every administrative override.
- Audit events are append-only; update and delete operations on the ledger are rejected at the database level.
- A verification routine recomputes the chain for any auction and reports whether the recorded history is intact, identifying the first divergent event if it is not.
- The audit trail of a completed auction can be exported in a machine-readable format for external verification.

### FR15. Automated Closing and Winner Determination

- A scheduler closes each auction at its closing time, applying any anti-sniping extension first, and freezes the bid ledger for that auction.
- The winner is determined by the published ranking rule: the highest valid, non-withdrawn bid, with the earliest timestamp breaking a tie.
- If the highest bid does not meet the reserve price, the auction is recorded as not meeting the reserve and referred to the organization for a decision.
- If an unresolved high-severity anomaly flag exists, the outcome is marked provisional and the auction enters the under-review state pending a compliance decision.
- All participants are notified of the outcome, and the result is published on a public result page.

### FR16. Auction Reporting and Dashboards

- On closing, the system generates an auction report containing the auction parameters, the participant count, the complete bid timeline, the winner and winning amount, any flags raised and their resolution, and the audit chain verification status.
- Reports can be exported as PDF and CSV.
- The organizational dashboard presents active auctions, upcoming auctions, completed auctions, total bids, registered participants, flagged auctions, and open anomaly alerts.
- The platform administrator dashboard aggregates the same indicators across all organizations.
- Analytical views present realised value by category, average number of bidders per auction, and the proportion of auctions that failed to meet the reserve.

### FR17. AI Assistant

- A participant can request a concise summary of an attached auction document.
- A participant can ask questions about an auction in natural language and receive answers grounded strictly in the published auction data and documents.
- The assistant states explicitly when the answer is not contained in the available material and never invents eligibility rules, prices, or deadlines.
- An administrator can request a summary of the activity of an auction or a natural-language explanation of an anomaly flag.

### FR18. Notification Management

- The system notifies users of verification outcomes, publication of auctions matching a saved search, being outbid, imminent closing of a watched auction, auction extension, outcome of an auction, and anomaly flags assigned for review.
- Notifications are delivered in the application and by e-mail, with the delivery channel configurable by the user.
- Every notification is stored with its read status.

### FR19. Dispute and Appeal Handling

- A participant may raise a dispute against an auction outcome within a configured period, stating the grounds and attaching evidence.
- A dispute is assigned to a compliance officer, who records a decision with a written justification.
- Raising a dispute on an auction places it in the under-review state until the dispute is resolved.
- All dispute actions are recorded in the audit trail.

### FR20. Data Logging and History

- The system retains the complete bidding history of every user and every auction.
- Administrative queries can retrieve the history of an auction, an organization, or a participant over a date range.
- Operational logs of authentication events, administrative actions, and system errors are retained separately from the audit ledger.

| ID | Requirement | Primary Actor | Related Use Case |
|---|---|---|---|
| FR1 | Registration, authentication, and authorization | All users | UC02 |
| FR2 | Bidder verification (KYC) | Bidder, Platform Administrator | UC03 |
| FR3 | Organization onboarding and role management | Platform Administrator, Organization Administrator | UC01, UC04 |
| FR4 | Auction creation and publication | Auction Officer, Organization Administrator | UC05 |
| FR5 | AI-powered item categorization | AI Service | UC06 |
| FR6 | Auction search, filtering, and discovery | Guest, Bidder | UC07 |
| FR7 | Deposit registration | Bidder, Auction Officer | UC08 |
| FR8 | Real-time bidding | Bidder | UC08 |
| FR9 | Sealed-bid submission | Bidder | UC09 |
| FR10 | Anti-sniping auction extension | System | UC08, UC13 |
| FR11 | Bid withdrawal | Bidder | UC10 |
| FR12 | AI anomaly detection | AI Service, Compliance Officer | UC11, UC12 |
| FR13 | Fraud and account integrity monitoring | Platform Administrator | UC11 |
| FR14 | Digital audit trail | System, Compliance Officer | UC14, UC18 |
| FR15 | Automated closing and winner determination | System, Auction Officer | UC13 |
| FR16 | Auction reporting and dashboards | Organization Administrator | UC14 |
| FR17 | AI assistant | Bidder, Auction Officer | UC15 |
| FR18 | Notification management | System | UC16 |
| FR19 | Dispute and appeal handling | Bidder, Compliance Officer | UC17 |
| FR20 | Data logging and history | System | UC14, UC18 |

*Table 3: CH2 - Summary of Functional Requirements*


///// ================================================ \\\\\\\

The biggest unresolved question isn't technical, though.

It's:

Why would an institution adopt this instead of whatever procurement/auction process it already uses?

Your answer needs to be extremely sharp.

The document currently says the existing process has physical-access limitations, paper records, invisible collusion patterns, slow/error-prone tabulation, and unpublished outcomes.

That's the foundation of your pitch.

So I'd frame the problem as:

Institutional auctions are not merely an auction problem. They are an information, accessibility, integrity, and accountability problem.

Then your system attacks each one:

Problem	Your system
Physical participation	Online bidding
Difficult documents	AI document assistant
Poor discovery	Search + categorization
Manual tabulation	Automatic winner determination
Hard-to-prove history	Hash-chained audit ledger
Suspicious behavior invisible	Anomaly detection
Unclear outcomes	Public result + audit verification

That's a coherent product.

So, my current assessment:

Concept: strong.

Technical depth: very strong for a hackathon.

AI component: potentially strong, because it's actually integrated into the workflow.

Social/business problem: credible, but you need evidence and a very clear problem narrative.

Biggest weakness: scope.

Biggest opportunity: make the auditability + anomaly detection + document intelligence the center of the demo instead of trying to demonstrate every FR1–FR20 feature.
