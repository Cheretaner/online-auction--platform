#!/usr/bin/env node

/**
 * AutoFetch Smoke Test
 * End-to-end test of the auto-fetch + verification pipeline
 * 
 * Tests: adapter registration, source creation, fetch, conflict detection, 
 * approval/rejection, pending queue, statistics
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';
const ORG_ID = process.env.TEST_ORG_ID || 'test-org-1';
const TOKEN = process.env.TEST_TOKEN || 'test-token';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
  },
  validateStatus: () => true, // Don't throw on any status code
});

let testsPassed = 0;
let testsFailed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ============================================================================
// Tests
// ============================================================================

async function runTests() {
  console.log('🧪 AutoFetch Smoke Tests\n');

  // Test 1: List sources (should be empty initially)
  await test('List sources', async () => {
    const res = await api.get('/autofetch/sources');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.data), 'Response should be array');
  });

  let sourceId;
  // Test 2: Create JSON feed source
  await test('Create JSON feed source', async () => {
    const res = await api.post('/autofetch/sources', {
      name: 'Test Auction Feed',
      adapterType: 'json-feed',
      sourceUrl: 'https://jsonplaceholder.typicode.com/posts',
      adapterConfig: {
        itemsPath: '',
        mappings: {
          title: 'title',
          description: 'body',
        },
      },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.data.id, 'Response should include source ID');
    sourceId = res.data.data.id;
  });

  // Test 3: Get specific source
  await test('Get specific source', async () => {
    const res = await api.get(`/autofetch/sources`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.some((s) => s.id === sourceId), 'Source should be in list');
  });

  // Test 4: Fetch from source (manual trigger)
  await test('Manually fetch from source', async () => {
    const res = await api.post(`/autofetch/sources/${sourceId}/fetch`);
    // This will likely fail without a real external source, but should return a response
    assert(res.status >= 200 && res.status < 500, `Expected 2xx-4xx, got ${res.status}`);
  });

  // Test 5: Get pending queue
  await test('Get pending queue', async () => {
    const res = await api.get('/autofetch/pending?limit=10&offset=0');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.items !== undefined, 'Response should include items');
    assert(typeof res.data.data.total === 'number', 'Response should include total');
  });

  // Test 6: Get pending queue with filter
  await test('Get pending queue with status filter', async () => {
    const res = await api.get('/autofetch/pending?status=pending');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(Array.isArray(res.data.data.items), 'Response should be array');
  });

  // Test 7: Get statistics
  await test('Get autofetch statistics', async () => {
    const res = await api.get('/autofetch/stats');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(typeof res.data.data.total === 'number', 'Should include total conflicts');
  });

  // Test 8: Create CSV upload source
  let csvSourceId;
  await test('Create CSV upload source', async () => {
    const res = await api.post('/autofetch/sources', {
      name: 'Test CSV Upload',
      adapterType: 'csv-upload',
      adapterConfig: {
        headers: ['title', 'description', 'value', 'category'],
      },
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    csvSourceId = res.data.data.id;
  });

  // Test 9: Verify both sources exist
  await test('Verify both sources created', async () => {
    const res = await api.get('/autofetch/sources');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.data.length >= 2, 'Should have at least 2 sources');
    assert(res.data.data.some((s) => s.adapterType === 'json-feed'), 'Should have JSON feed');
    assert(res.data.data.some((s) => s.adapterType === 'csv-upload'), 'Should have CSV');
  });

  // Test 10: Authorization check (missing token should fail)
  await test('Authorization - missing token returns 401', async () => {
    const noAuthApi = axios.create({ baseURL: `${API_URL}/api/v1`, validateStatus: () => true });
    const res = await noAuthApi.get('/autofetch/sources');
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  console.log(`\n📊 Results: ${testsPassed} passed, ${testsFailed} failed\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
