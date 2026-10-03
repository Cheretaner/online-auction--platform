# Public open-data API

`GET /api/v1/open-data/auctions` is unauthenticated and returns published auctions in the public states `scheduled`, `live`, `closed`, `under_review`, and `awarded`.

## Query parameters

- `limit`: integer from 1 to 100; defaults to 100.
- `offset`: integer from 0 to 1,000,000; defaults to 0.
- Requests are limited to 60 per client IP per minute in addition to the API-wide limit. Invalid values return validation errors.

## Response

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Public notice title",
      "organization": "Public organization name",
      "type": "open_ascending",
      "status": "awarded",
      "region": "Addis Ababa",
      "startPrice": "1000.00",
      "winningAmount": "1250.00",
      "bidCount": 3,
      "opensAt": "2026-10-01T09:00:00.000Z",
      "closesAt": "2026-10-08T09:00:00.000Z",
      "closedAt": "2026-10-08T09:00:00.000Z",
      "awardedAt": "2026-10-08T10:00:00.000Z",
      "publishedAt": "2026-09-24T12:00:00.000Z"
    }
  ],
  "total": 1,
  "limit": 100,
  "offset": 0
}
```

All timestamps are UTC ISO-8601 strings. `winningAmount` is present only after an award. The response contains no bidder names, account IDs, contact details, KYC data, or private documents. The server allows public caching for five minutes with up to fifteen minutes of stale-while-revalidate.

The `v1` path is the compatibility boundary. Additive fields can be introduced; removing or changing field meaning requires a versioned route and a deprecation period. Do not add winner identity, individual bid history, or document URLs without an explicit privacy and disclosure decision.
