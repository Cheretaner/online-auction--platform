## What this changes

## Related
SRS section / RFC section / Build plan day:

## Checklist
- [ ] Works on staging, not only locally
- [ ] Has a test for the rule it implements
- [ ] Contract changes are in `packages/shared` in this same PR
- [ ] Every state-changing path writes its audit event
- [ ] Errors return the shared error codes