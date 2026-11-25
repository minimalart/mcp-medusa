# Medusa filter contracts

The `Medusa filter contracts` GitHub Actions workflow boots Medusa 2.22.1, the version used by Brick, against a fresh PostgreSQL 16 service. It creates two distinguishable records per resource through the Admin API and runs the real MCP tool executor against that instance. The fixture uses a dedicated database, local credentials and no production access.

The matrix in `filters.test.js` is the coverage inventory. Each contract checks that the unfiltered list contains both fixtures, then checks exact returned IDs and total count with a matching and a nonmatching value or a contrasting valid value. A 200 with the unfiltered result fails the contract. This covers selected core lists for orders, drafts, products, variants, categories, tags, types, collections, customers, inventory, stock locations, sales channels, regions, tax rates, return and refund reasons, promotions, price lists and campaigns.

The fixture runs stock Medusa. Brick-only extensions, tenant scoping and provider-dependent lists need their own fixtures. The order cart-link and tax-line variants of the earlier filter fixes still have unit coverage. The suite does not generate live orders, notifications, or payments.

## Known deviations on Medusa 2.22.1

| MCP action | Input | Observed behavior |
| --- | --- | --- |
| `sales_channels.list` | `name`, `is_disabled` | The MCP omits the arguments. Medusa supports them and the MCP returns the unfiltered list with HTTP 200. |
| `pricing.list_promotions` | `status` | The MCP omits the argument and returns the unfiltered list with HTTP 200. The upstream route does not accept a status filter. |
| `customers.list` | `phone` | The upstream route rejects the argument with HTTP 400. |
| `draft_orders.list` | `email` | The upstream route rejects the argument with HTTP 400. |

The tests label these specific results as TODO. Any change from the recorded outcome fails the check so the entry must be revisited. All other entries are strict assertions.

## Running locally

Use an empty PostgreSQL 16 database named `mcp_contracts`. The workflow contains the exact migration, local admin creation and startup commands. With the fixture running on `http://127.0.0.1:9100`, run `npm run test:contracts` from the repository root. Use a fresh database each time because the suite creates records through the Admin API. To use a different local port, set `CONTRACT_MEDUSA_URL`.
