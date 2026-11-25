# Medusa filter contracts

The `Medusa filter contracts` GitHub Actions workflow boots Medusa 2.22.1, the version used by Brick, against a fresh PostgreSQL 16 service. It creates two distinguishable records per resource through the Admin API and runs the real MCP tool executor against that instance. The fixture uses a dedicated database, local credentials and no production access.

The matrix in `filters.test.js` is the coverage inventory. Each contract checks that the unfiltered list contains both fixtures, then checks exact returned IDs and total count with a matching and a nonmatching value or a contrasting valid value. A 200 with the unfiltered result fails the contract. This covers selected core lists for orders, drafts, products, variants, categories, tags, types, collections, customers, inventory, stock locations, sales channels, regions, tax rates, return and refund reasons, promotions, price lists and campaigns.

The fixture runs stock Medusa. It covers payment-provider ID and enabled state, fulfillment-provider ID and enabled state, manual provider options, tax-provider ID and shipping-option provider, zone and stock location. It registers disabled test rows in the isolated database and uses the manual fulfillment provider for option creation. The suite never invokes an external payment or shipping provider. Brick separately tests its Admin extension handlers with synthetic store and provider data.

The core filter assertions are strict. Sales channel `name` and `is_disabled` must reach Medusa. Promotion `status`, customer `phone` and draft order `email` must filter correctly even when Medusa cannot accept the parameter directly.

Two new shipping-option discrepancies are tracked as TODO after checking the exact observed behavior. `region_id` is rejected with HTTP 400. `is_return: true` returns HTTP 500 on Medusa 2.22.1, and `is_return: false` is omitted by the tool so the request returns both options with HTTP 200. A change in either recorded outcome fails CI for review. The provider, service zone and stock location filters are available through `manage_medusa_admin_v2` on `/admin/shipping-options` and checked strictly.

## Running locally

Use an empty PostgreSQL 16 database named `mcp_contracts`. The workflow contains the exact migration, local admin creation and startup commands. With the fixture running on `http://127.0.0.1:9100`, run `npm run test:contracts` from the repository root. Use a fresh database each time because the suite creates records through the Admin API. To use a different local port, set `CONTRACT_MEDUSA_URL`.
