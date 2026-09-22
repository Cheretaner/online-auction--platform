/**
 * Auto-fetch + Verification Pipeline
 * Complete export surface for autofetch module
 */

// Types
export * from './types/index.js';

// Adapters
export * from './adapters/index.js';

// Conflict Detection
export * from './conflict/index.js';

// Services
export { AutoFetchService } from './autofetch.service.js';
export { AutoFetchRepository } from './autofetch.repository.js';
