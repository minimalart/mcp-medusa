import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listByExactField } from '../../lib/medusa-list-filter.js';

test('applies pagination after exact matching and preserves candidate order', async () => {
  const responses = [
    { promotions: [{ id: 'first', status: 'active' }, { id: 'ignored', status: 'draft' }], count: 5 },
    { promotions: [{ id: 'second', status: 'active' }, { id: 'third', status: 'active' }, { id: 'last', status: 'active' }], count: 5 },
    { promotions: [{ id: 'third' }, { id: 'second' }] },
  ];
  const queries = [];
  const result = await listByExactField({
    read: async (query) => {
      queries.push(query);
      return responses.shift();
    },
    query: { limit: 2, offset: 1, fields: 'id,code', q: 'promo' },
    key: 'promotions', field: 'status', matches: (value) => value === 'active',
  });

  assert.deepEqual(queries, [
    { limit: 50, offset: 0, fields: 'id,status', q: 'promo' },
    { limit: 50, offset: 2, fields: 'id,status', q: 'promo' },
    { limit: 2, offset: 0, fields: 'id,code', q: 'promo', id: ['second', 'third'] },
  ]);
  assert.deepEqual(result, { promotions: [{ id: 'second' }, { id: 'third' }], count: 4, limit: 2, offset: 1 });
});
