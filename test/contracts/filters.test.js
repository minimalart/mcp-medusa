import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { discoverTools, executeToolOptimized } from '../../lib/tools.js';

const configuredUrl = new URL(process.env.CONTRACT_MEDUSA_URL ?? 'http://127.0.0.1:9100');
assert.ok(['127.0.0.1', 'localhost'].includes(configuredUrl.hostname), 'Use a disposable local Medusa');
const baseUrl = configuredUrl.origin;
const missing = 'contract-no-such-8bc973';
const admin = { email: 'contracts@example.test', password: 'local-contract-password' };
const fixtures = {};
const { Client } = createRequire(new URL('./medusa/package.json', import.meta.url))('pg');
const disabledPayment = 'pp_contract_disabled';
const disabledFulfillment = 'contract_disabled';
let tools;
let token;

async function request(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  assert.ok(response.ok, `${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function createPair(key, path, entity, build) {
  const records = [];
  for (const [index, name] of ['Mercury', 'Venus'].entries()) {
    const { [entity]: record } = await request(`/admin/${path}`, build(name, index));
    assert.ok(record?.id, `${path} did not return a ${entity} ID`);
    records.push(record);
  }
  fixtures[key] = records;
}

async function seedProviderRegistry() {
  const database = new URL(process.env.CONTRACT_DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname === '/mcp_contracts',
    'Provider fixtures require a disposable local database');
  const db = new Client({ connectionString: database.href });
  await db.connect();
  try {
    // The Admin API cannot register a disabled provider. Seed registry rows only;
    // these IDs never initiate payments or call a carrier.
    await db.query('insert into payment_provider (id, is_enabled) values ($1, false)', [disabledPayment]);
    await db.query('insert into fulfillment_provider (id, is_enabled) values ($1, false)', [disabledFulfillment]);
  } finally {
    await db.end();
  }
}

async function seedShippingOptions() {
  const { fulfillment_providers } = await request('/admin/fulfillment-providers');
  const manual = fulfillment_providers.find(({ id }) => id.startsWith('manual_'));
  assert.ok(manual, 'The local manual fulfillment provider must be registered');
  const { shipping_profile } = await request('/admin/shipping-profiles', { name: 'Contract profile', type: 'default' });
  fixtures.shippingZones = [];
  for (const [store, location] of fixtures.locations.entries()) {
    await request(`/admin/stock-locations/${location.id}/fulfillment-providers`, { add: [manual.id] });
    const { stock_location } = await request(`/admin/stock-locations/${location.id}/fulfillment-sets?fields=id,fulfillment_sets.id`, {
      name: `Contract set ${store}`, type: 'shipping',
    });
    const setId = stock_location.fulfillment_sets[0].id;
    const { fulfillment_set } = await request(`/admin/fulfillment-sets/${setId}/service-zones?fields=id,service_zones.id`, {
      name: `Contract zone ${store}`,
      geo_zones: (store === 0 ? ['us'] : ['us', 'ca']).map((country_code) => ({ type: 'country', country_code })),
    });
    const zoneId = fulfillment_set.service_zones[0].id;
    fixtures.shippingZones.push(zoneId);
    await createPair(`shippingOptions${store}`, 'shipping-options', 'shipping_option', (name, index) => ({
      name, service_zone_id: zoneId, shipping_profile_id: shipping_profile.id, provider_id: manual.id,
      price_type: 'flat', type: { label: `Contract ${name} ${store}`, code: `contract-${name.toLowerCase()}-${store}`, description: name },
      prices: [{ currency_code: 'usd', amount: 1000 }],
      rules: [{ attribute: 'is_return', operator: 'eq', value: String(index === 1) }],
    }));
  }
  fixtures.shippingProviderId = manual.id;
}

before(async () => {
  const deadline = Date.now() + 90000;
  while (true) {
    try {
      const health = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
      if (health.ok) break;
    } catch {
      // Medusa may still be starting.
    }
    if (Date.now() >= deadline) throw new Error(`Medusa did not become ready at ${baseUrl}`);
    await sleep(1000);
  }
  ({ token } = await request('/auth/user/emailpass', admin));
  assert.ok(token, 'Fixture admin login did not return a JWT');
  process.env.MEDUSA_BASE_URL = baseUrl;
  process.env.MEDUSA_API_KEY = token;
  process.env.MEDUSA_AUTH_TYPE = 'jwt';
  tools = await discoverTools();
  await seedProviderRegistry();

  await createPair('collections', 'collections', 'collection', (name) => ({ title: name, handle: `collection-${name.toLowerCase()}` }));
  await createPair('categories', 'product-categories', 'product_category', (name) => ({ name }));
  await createPair('tags', 'product-tags', 'product_tag', (value) => ({ value }));
  await createPair('types', 'product-types', 'product_type', (value) => ({ value }));
  await createPair('channels', 'sales-channels', 'sales_channel', (name, index) => ({
    name: `Contract ${name}`, is_disabled: index === 1,
  }));
  await createPair('regions', 'regions', 'region', (name, index) => ({ name, currency_code: 'usd', countries: [index ? 'ca' : 'us'] }));
  await createPair('customers', 'customers', 'customer', (name, index) => ({
    first_name: name, last_name: `${name}son`, email: `${name.toLowerCase()}@example.test`, phone: `555000000${index}`,
  }));
  await createPair('products', 'products', 'product', (name, index) => ({
    title: name, handle: `product-${name.toLowerCase()}`, external_id: `external-${name.toLowerCase()}`,
    status: index ? 'draft' : 'published', collection_id: fixtures.collections[index].id,
    categories: [{ id: fixtures.categories[index].id }], tags: [{ id: fixtures.tags[index].id }],
    type_id: fixtures.types[index].id, sales_channels: [{ id: fixtures.channels[index].id }],
    options: [{ title: 'Size', values: ['Standard'] }],
    variants: [{ title: `${name} variant`, sku: `variant-${name.toLowerCase()}`, manage_inventory: false,
      options: { Size: 'Standard' }, prices: [{ currency_code: 'usd', amount: 1000 }] }],
  }));
  await createPair('inventory', 'inventory-items', 'inventory_item', (name, index) => ({
    title: name, sku: `stock-${name.toLowerCase()}`, origin_country: index ? 'ca' : 'us',
  }));
  await createPair('locations', 'stock-locations', 'stock_location', (name) => ({ name }));
  await seedShippingOptions();
  await createPair('taxRegions', 'tax-regions', 'tax_region', (_name, index) => ({
    country_code: index ? 'ca' : 'us', provider_id: 'tp_system',
  }));
  await createPair('taxRates', 'tax-rates', 'tax_rate', (name, index) => ({
    name, code: `TAX-${name.toUpperCase()}`, rate: 10 + index, tax_region_id: fixtures.taxRegions[index].id,
  }));
  await createPair('returnReasons', 'return-reasons', 'return_reason', (label) => ({ label, value: label.toLowerCase() }));
  await createPair('refundReasons', 'refund-reasons', 'refund_reason', (label) => ({ label, code: label.toLowerCase() }));
  await createPair('promotions', 'promotions', 'promotion', (name, index) => ({
    code: `PROMO-${name.toUpperCase()}`, type: 'standard', status: index ? 'inactive' : 'active',
    application_method: { type: 'percentage', target_type: 'order', allocation: 'across', value: 10 },
  }));
  await createPair('priceLists', 'price-lists', 'price_list', (title) => ({ title, description: title, type: 'sale' }));
  await createPair('campaigns', 'campaigns', 'campaign', (name) => ({
    name, campaign_identifier: `campaign-${name.toLowerCase()}`,
  }));
  const draft = (name, index) => ({
    email: fixtures.customers[index].email, customer_id: fixtures.customers[index].id,
    region_id: fixtures.regions[index].id, sales_channel_id: fixtures.channels[0].id,
    items: [{ title: `${name} custom item`, unit_price: 1000, quantity: 1 }],
  });
  await createPair('drafts', 'draft-orders', 'draft_order', draft);
  fixtures.orders = [];
  for (const { id } of fixtures.drafts) {
    const { order } = await request(`/admin/draft-orders/${id}/convert-to-order`, {});
    assert.ok(order?.id, 'Draft conversion must return an order');
    fixtures.orders.push(order);
  }
  await request(`/admin/orders/${fixtures.orders[1].id}/cancel`, {});
  await createPair('drafts', 'draft-orders', 'draft_order', draft);
  fixtures.variants = fixtures.products.map((product) => product.variants[0]);
}, { timeout: 120000 });

async function readTool(tool, args, key) {
  const result = await executeToolOptimized(tools, `manage_medusa_admin_${tool}`, { limit: 25, ...args });
  assert.equal(result.isError ?? false, false, JSON.stringify(result.content));
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.error, undefined, JSON.stringify(payload));
  assert.ok(Array.isArray(payload[key]), `Missing ${key} in ${tool}.${args.action}`);
  return { count: payload.count, ids: payload[key].map((row) => row.id).sort() };
}

const afterFixture = { $gte: '2999-01-01T00:00:00Z' };
const beforeFixture = { $gte: '2020-01-01T00:00:00Z' };

const cases = [
  { tool: 'products', action: 'list', key: 'products', set: 'products', filters: [
    ['q', 'Mercury', missing], ['handle', (a) => a.handle, missing],
    ['status', ['published'], ['draft'], [0], [1]],
    ['collection_id', () => [fixtures.collections[0].id], ['pcol_missing']],
    ['category_id', () => [fixtures.categories[0].id], ['pcat_missing']],
    ['tag_id', () => [fixtures.tags[0].id], ['ptag_missing']],
    ['type_id', () => [fixtures.types[0].id], ['ptyp_missing']],
    ['created_at', beforeFixture, afterFixture, [0, 1]], ['updated_at', beforeFixture, afterFixture, [0, 1]],
  ] },
  { tool: 'products', action: 'list_all_variants', key: 'variants', set: 'variants', filters: [
    ['q', 'Mercury', missing], ['sku', (a) => a.sku, missing],
  ] },
  { tool: 'products', action: 'list_categories', key: 'product_categories', set: 'categories', filters: [['q', 'Mercury', missing]] },
  { tool: 'products', action: 'list_tags', key: 'product_tags', set: 'tags', filters: [['q', 'Mercury', missing]] },
  { tool: 'products', action: 'list_types', key: 'product_types', set: 'types', filters: [['q', 'Mercury', missing]] },
  { tool: 'collections', action: 'list', key: 'collections', set: 'collections', filters: [
    ['q', 'Mercury', missing], ['handle', (a) => a.handle, missing], ['title', 'Mercury', missing],
    ['created_at', beforeFixture, afterFixture, [0, 1]], ['updated_at', beforeFixture, afterFixture, [0, 1]],
  ] },
  { tool: 'customers', action: 'list', key: 'customers', set: 'customers', filters: [
    ['q', 'Mercury', missing], ['email', (a) => a.email, `${missing}@example.test`],
    ['first_name', (a) => a.first_name, missing], ['last_name', (a) => a.last_name, missing],
    ['phone', (a) => a.phone, '5559999999'], ['created_at', beforeFixture, afterFixture, [0, 1]],
    ['updated_at', beforeFixture, afterFixture, [0, 1]],
  ] },
  { tool: 'inventory', action: 'list_items', key: 'inventory_items', set: 'inventory', filters: [
    ['q', 'Mercury', missing], ['sku', (a) => a.sku, missing], ['origin_country', 'us', 'ca', [0], [1]],
  ] },
  { tool: 'inventory', action: 'list_locations', key: 'stock_locations', set: 'locations', filters: [
    ['q', 'Mercury', missing], ['name', 'Mercury', missing],
  ] },
  { tool: 'sales_channels', action: 'list', key: 'sales_channels', set: 'channels', scope: { q: 'Contract' }, filters: [
    ['q', 'Mercury', missing], ['name', (a) => a.name, missing], ['is_disabled', true, false, [1], [0]],
  ] },
  { tool: 'regions', action: 'list_regions', key: 'regions', set: 'regions', filters: [['q', 'Mercury', missing]] },
  { tool: 'taxes', action: 'list_tax_rates', key: 'tax_rates', set: 'taxRates', filters: [
    ['tax_region_id', () => fixtures.taxRegions[0].id, 'txreg_missing'],
  ] },
  { tool: 'returns', action: 'list_return_reasons', key: 'return_reasons', set: 'returnReasons', filters: [['q', 'Mercury', missing]] },
  { tool: 'payments', action: 'list_refund_reasons', key: 'refund_reasons', set: 'refundReasons', filters: [['q', 'Mercury', missing]] },
  { tool: 'pricing', action: 'list_promotions', key: 'promotions', set: 'promotions', filters: [
    ['q', 'MERCURY', missing], ['code', (a) => a.code, missing], ['status', 'active', 'inactive', [0], [1]],
  ] },
  { tool: 'pricing', action: 'list_price_lists', key: 'price_lists', set: 'priceLists', filters: [['q', 'Mercury', missing]] },
  { tool: 'pricing', action: 'list_campaigns', key: 'campaigns', set: 'campaigns', filters: [['q', 'Mercury', missing]] },
  { tool: 'draft_orders', action: 'list', key: 'draft_orders', set: 'drafts', filters: [
    ['q', () => fixtures.customers[0].email, missing],
    ['region_id', () => fixtures.regions[0].id, 'reg_missing'],
    ['customer_id', () => fixtures.customers[0].id, 'cus_missing'],
    ['email', () => fixtures.customers[0].email.toUpperCase(), `${missing}@example.test`],
  ] },
  { tool: 'orders', action: 'list', key: 'orders', set: 'orders', filters: [
    ['q', () => fixtures.customers[0].email, missing],
    ['display_id', (a) => `#${a.display_id}`, '999999999'],
    ['status', 'pending', 'canceled', [0], [1]],
    ['region_id', () => fixtures.regions[0].id, 'reg_missing'],
    ['customer_id', () => fixtures.customers[0].id, 'cus_missing'],
    ['email', () => fixtures.customers[0].email, `${missing}@example.test`],
    ['created_at', beforeFixture, afterFixture, [0, 1]], ['updated_at', beforeFixture, afterFixture, [0, 1]],
  ] },
];

for (const { tool, action, key, set, scope, filters } of cases) {
  test(`${tool}.${action} contracts`, async (t) => {
    const records = fixtures[set];
    const baseline = await readTool(tool, { action, ...scope }, key);
    for (const record of records) assert.ok(baseline.ids.includes(record.id), 'Unfiltered response must contain both fixtures');
    for (const [filter, matching, control, selected = [0], excluded = []] of filters) {
      await t.test(filter, async () => {
        const input = typeof matching === 'function' ? matching(records[0]) : matching;
        const read = (value) => readTool(tool, { action, ...scope, [filter]: value }, key);
        const match = await read(input);
        const other = await read(control);
        const expected = (indexes) => ({ count: indexes.length, ids: indexes.map((index) => records[index].id).sort() });
        assert.deepEqual(match, expected(selected), `${filter} returned the wrong IDs for a matching value`);
        assert.deepEqual(other, expected(excluded), `${filter} returned the wrong IDs for its control value`);
      });
    }
  });
}

test('exact customer phone composes with native filters and paginates the matches', async () => {
  const [matching, other] = fixtures.customers;
  const args = { action: 'list', phone: matching.phone, email: matching.email, limit: 1 };
  assert.deepEqual(await readTool('customers', args, 'customers'), { count: 1, ids: [matching.id] });
  assert.deepEqual(await readTool('customers', { ...args, offset: 1 }, 'customers'), { count: 1, ids: [] });
  assert.deepEqual(await readTool('customers', { ...args, email: other.email }, 'customers'), { count: 0, ids: [] });
});

test('payment provider filters select an exact ID or enabled state', async () => {
  const action = 'list_payment_providers';
  const key = 'payment_providers';
  const read = (filters) => readTool('payments', { action, ...filters }, key);
  const baseline = await read({});
  assert.ok(baseline.ids.includes(disabledPayment));
  assert.ok(baseline.ids.includes('pp_system_default'));
  assert.deepEqual(await read({ provider_id: 'pp_system_default' }), { count: 1, ids: ['pp_system_default'] });
  assert.deepEqual(await read({ provider_id: 'pp_contract_missing' }), { count: 0, ids: [] });
  assert.deepEqual(await read({ is_enabled: false }), { count: 1, ids: [disabledPayment] });
  assert.deepEqual(await read({ is_enabled: true }), {
    count: baseline.count - 1, ids: baseline.ids.filter((id) => id !== disabledPayment),
  });
});

test('fulfillment provider ID and state select registry rows and provider-specific options', async () => {
  const key = 'fulfillment_providers';
  const baseline = await readTool('regions', { action: 'list_fulfillment_providers' }, key);
  const manual = baseline.ids.find((id) => id.startsWith('manual_'));
  assert.ok(manual && baseline.ids.includes(disabledFulfillment));
  const read = (query) => readTool('v2', { action: 'request', method: 'GET', path: '/admin/fulfillment-providers', query }, key);
  assert.deepEqual(await read({ id: manual }), { count: 1, ids: [manual] });
  assert.deepEqual(await read({ id: 'contract_missing' }), { count: 0, ids: [] });
  assert.deepEqual(await read({ is_enabled: false }), { count: 1, ids: [disabledFulfillment] });
  assert.deepEqual(await read({ is_enabled: true }), {
    count: baseline.count - 1, ids: baseline.ids.filter((id) => id !== disabledFulfillment),
  });
  const options = { action: 'list_fulfillment_provider_options', provider_id: manual };
  assert.deepEqual(await readTool('regions', options, 'fulfillment_options'), {
    count: 2, ids: ['manual-fulfillment', 'manual-fulfillment-return'],
  });
});

test('tax provider list preserves the exact provider ID', async () => {
  const read = (id) => readTool('v2', { action: 'list', resource: 'tax_providers', query: { id } }, 'tax_providers');
  assert.deepEqual(await read('tp_system'), { count: 1, ids: ['tp_system'] });
  assert.deepEqual(await read('tp_contract_missing'), { count: 0, ids: [] });
});

test('shipping options select the manual fulfillment provider, zone and stock location', async () => {
  const read = (query) => readTool('v2', { action: 'request', method: 'GET', path: '/admin/shipping-options', query }, 'shipping_options');
  const { shippingOptions0: a, shippingOptions1: b } = fixtures;
  for (const [filter, match, expected, control] of [
    ['provider_id', fixtures.shippingProviderId, [...a, ...b], disabledFulfillment],
    ['service_zone_id', fixtures.shippingZones[0], a, 'serzo_contract_missing'],
    ['stock_location_id', fixtures.locations[0].id, a, 'sloc_contract_missing'],
    ['stock_location_id', fixtures.locations[1].id, b, 'sloc_contract_missing'],
  ]) {
    assert.deepEqual(await read({ [filter]: match }), shippingResult(expected), filter);
    assert.deepEqual(await read({ [filter]: control }), { count: 0, ids: [] }, filter);
  }
});

const shippingResult = (options) => ({ count: options.length, ids: options.map(({ id }) => id).sort() });

test('shipping option region and return filters compose across locations in a shared region', async (t) => {
  const read = (filters) => readTool('regions', { action: 'list_shipping_options', ...filters }, 'shipping_options');
  const { shippingOptions0: a, shippingOptions1: b, regions, locations } = fixtures;
  assert.deepEqual(await read({}), shippingResult([...a, ...b]));
  await t.test('region_id', async () => {
    assert.deepEqual(await read({ region_id: regions[0].id }), shippingResult([...a, ...b]));
    assert.deepEqual(await read({ region_id: regions[1].id }), shippingResult(b));
    assert.deepEqual(await read({ region_id: 'reg_contract_missing' }), shippingResult([]));
    assert.deepEqual(await read({ region_id: regions[1].id, stock_location_id: locations[0].id }), shippingResult([]));
  });
  await t.test('is_return', async () => {
    assert.deepEqual(await read({ is_return: true }), shippingResult([a[1], b[1]]));
    assert.deepEqual(await read({ is_return: false }), shippingResult([a[0], b[0]]));
    for (const [index, options] of [a, b].entries()) {
      const scope = { region_id: regions[0].id, stock_location_id: locations[index].id };
      assert.deepEqual(await read({ ...scope, is_return: false }), shippingResult([options[0]]));
      assert.deepEqual(await read({ ...scope, is_return: true }), shippingResult([options[1]]));
      assert.deepEqual(await read({ ...scope, is_return: true, limit: 1, offset: 1 }), { count: 1, ids: [] });
    }
  });
});
