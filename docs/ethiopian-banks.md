# Ethiopian Bank Directory Snapshot

The shared `ETHIOPIAN_BANKS` enum is a snapshot of the 32 published records in the National Bank of Ethiopia (NBE) bank directory, retrieved on 2026-10-02 from the NBE directory's public WordPress API. Names are kept as published so existing instruments can be matched consistently. NBE may update its directory; refresh this snapshot and the enum together when the authoritative source changes.

Sources:

- NBE licensed-bank directory: https://nbe.gov.et/financial-institutions/banks/
- NBE public directory records: https://nbe.gov.et/wp-json/wp/v2/bank?per_page=100

This list is for input validation only. A bank name or valid-looking reference does not verify an instrument, account balance, or payment. CPOs and guarantees still require confirmation through the issuing institution or an authorized verification channel.