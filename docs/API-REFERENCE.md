# MCP Medusa API Reference

## HTTP Endpoints

### Health Check

```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "version": "1.0.4",
  "transport": "streamable-http",
  "protocolVersion": "2025-03-26"
}
```

### Readiness Check

```http
GET /ready
```

**Response:**
```json
{
  "status": "ready",
  "toolsCount": 14,
  "medusaUrl": "configured"
}
```

### MCP Endpoint (Main)

```http
POST /mcp
Authorization: Bearer <MCP_AUTH_TOKEN>
Content-Type: application/json
```

## JSON-RPC Methods

### initialize

Initialize the MCP session.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "clientInfo": {
      "name": "your-app",
      "version": "1.0.0"
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "serverInfo": {
      "name": "medusa-admin-mcp-server",
      "version": "1.0.4"
    },
    "capabilities": {
      "tools": {}
    }
  }
}
```

### tools/list

List all available tools.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "manage_medusa_admin_orders",
        "description": "...",
        "inputSchema": { ... }
      }
    ]
  }
}
```

### tools/call

Execute a tool.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "manage_medusa_admin_orders",
    "arguments": {
      "action": "list",
      "limit": 10
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{ ... }"
      }
    ]
  }
}
```

### ping

Health check via JSON-RPC.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "ping"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "pong": true
  }
}
```

## Tool Reference

### manage_medusa_admin_orders

Order management and fulfillment operations.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List orders with filters |
| `get` | `id` | Get order by ID |
| `cancel` | `id` | Cancel an order |
| `complete` | `id` | Complete an order |
| `archive` | `id` | Archive an order |
| `transfer` | `id`, `customer_id` | Transfer order to customer |
| `list_fulfillments` | `id` | List fulfillments for order |
| `cancel_fulfillment` | `id`, `fulfillment_id` | Cancel a fulfillment |

**Example - List Orders:**
```json
{
  "action": "list",
  "limit": 20,
  "status": "pending"
}
```

**Example - Get Order:**
```json
{
  "action": "get",
  "id": "order_01H..."
}
```

### manage_medusa_admin_products

Product and variant management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List products |
| `get` | `id` | Get product by ID |
| `create` | `title` | Create product |
| `update` | `id` | Update product |
| `delete` | `id` | Delete product |
| `list_variants` | `id` | List variants |
| `get_variant` | `id`, `variant_id` | Get variant |
| `create_variant` | `id`, `variant_data` | Create variant |
| `update_variant` | `id`, `variant_id` | Update variant |
| `delete_variant` | `id`, `variant_id` | Delete variant |
| `list_categories` | - | List categories |
| `get_category` | `id` | Get category |
| `create_category` | `title` | Create category |
| `update_category` | `id` | Update category |
| `delete_category` | `id` | Delete category |
| `list_tags` | - | List tags |
| `list_types` | - | List types |

**Example - Create Product:**
```json
{
  "action": "create",
  "title": "New Product",
  "description": "Product description",
  "handle": "new-product"
}
```

### manage_medusa_admin_customers

Customer and group management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List customers |
| `get` | `id` | Get customer |
| `create` | `email` | Create customer |
| `update` | `id` | Update customer |
| `delete` | `id` | Delete customer |
| `list_addresses` | `id` | List addresses |
| `get_address` | `id`, `address_id` | Get address |
| `create_address` | `id`, `address_data` | Create address |
| `update_address` | `id`, `address_id` | Update address |
| `delete_address` | `id`, `address_id` | Delete address |
| `list_groups` | - | List customer groups |
| `get_group` | `group_id` | Get group |
| `create_group` | `group_name` | Create group |
| `update_group` | `group_id` | Update group |
| `delete_group` | `group_id` | Delete group |
| `add_to_group` | `id`, `group_id` | Add customer to group |
| `remove_from_group` | `id`, `group_id` | Remove from group |

### manage_medusa_admin_inventory

Inventory and stock management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_items` | - | List inventory items |
| `get_item` | `id` | Get inventory item |
| `create_item` | `sku` | Create inventory item |
| `update_item` | `id` | Update inventory item |
| `delete_item` | `id` | Delete inventory item |
| `list_locations` | - | List stock locations |
| `get_location` | `location_id` | Get stock location |
| `create_location` | `name` | Create stock location |
| `update_location` | `location_id` | Update stock location |
| `delete_location` | `location_id` | Delete stock location |
| `list_levels` | - | List inventory levels |
| `update_level` | `inventory_item_id`, `location_id` | Update level |
| `list_reservations` | - | List reservations |
| `create_reservation` | `inventory_item_id`, `location_id`, `quantity` | Create reservation |
| `update_reservation` | `reservation_id` | Update reservation |
| `delete_reservation` | `reservation_id` | Delete reservation |

### manage_medusa_admin_regions

Region and shipping management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_regions` | - | List regions |
| `get_region` | `id` | Get region |
| `create_region` | `name`, `currency_code` | Create region |
| `update_region` | `id` | Update region |
| `delete_region` | `id` | Delete region |
| `list_shipping_options` | - | List shipping options |
| `get_shipping_option` | `shipping_option_id` | Get shipping option |
| `create_shipping_option` | `name`, `region_id`, `provider_id` | Create shipping option |
| `update_shipping_option` | `shipping_option_id` | Update shipping option |
| `delete_shipping_option` | `shipping_option_id` | Delete shipping option |
| `list_shipping_profiles` | - | List shipping profiles |
| `get_shipping_profile` | `profile_id` | Get shipping profile |
| `create_shipping_profile` | `name`, `type` | Create shipping profile |
| `update_shipping_profile` | `profile_id` | Update shipping profile |
| `delete_shipping_profile` | `profile_id` | Delete shipping profile |
| `list_fulfillment_providers` | - | List fulfillment providers |
| `list_fulfillment_sets` | - | List fulfillment sets |
| `create_fulfillment_set` | `name`, `type` | Create fulfillment set |
| `update_fulfillment_set` | `fulfillment_set_id` | Update fulfillment set |
| `delete_fulfillment_set` | `fulfillment_set_id` | Delete fulfillment set |

### manage_medusa_admin_pricing

Pricing and promotions management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_price_lists` | - | List price lists |
| `get_price_list` | `id` | Get price list |
| `create_price_list` | `name`, `type` | Create price list |
| `update_price_list` | `id` | Update price list |
| `delete_price_list` | `id` | Delete price list |
| `list_promotions` | - | List promotions |
| `get_promotion` | `promotion_id` | Get promotion |
| `create_promotion` | `code` | Create promotion |
| `update_promotion` | `promotion_id` | Update promotion |
| `delete_promotion` | `promotion_id` | Delete promotion |
| `list_campaigns` | - | List campaigns |
| `get_campaign` | `campaign_id` | Get campaign |
| `create_campaign` | `name` | Create campaign |
| `update_campaign` | `campaign_id` | Update campaign |
| `delete_campaign` | `campaign_id` | Delete campaign |

### manage_medusa_admin_payments

Payment operations.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_payment_collections` | - | List payment collections |
| `get_payment_collection` | `id` | Get payment collection |
| `update_payment_collection` | `id` | Update payment collection |
| `delete_payment_collection` | `id` | Delete payment collection |
| `list_payments` | - | List payments |
| `get_payment` | `payment_id` | Get payment |
| `capture_payment` | `payment_id` | Capture payment |
| `cancel_payment` | `payment_id` | Cancel payment |
| `refund_payment` | `payment_id`, `amount` | Refund payment |
| `list_refunds` | - | List refunds |
| `get_refund` | `refund_id` | Get refund |

### manage_medusa_admin_returns

Returns and exchanges management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_returns` | - | List returns |
| `get_return` | `id` | Get return |
| `cancel_return` | `id` | Cancel return |
| `receive_return` | `id`, `items` | Receive return |
| `list_exchanges` | - | List exchanges |
| `get_exchange` | `exchange_id` | Get exchange |
| `cancel_exchange` | `exchange_id` | Cancel exchange |
| `list_claims` | - | List claims |
| `get_claim` | `claim_id` | Get claim |
| `update_claim` | `claim_id` | Update claim |
| `cancel_claim` | `claim_id` | Cancel claim |
| `list_order_edits` | - | List order edits |
| `get_order_edit` | `order_edit_id` | Get order edit |
| `update_order_edit` | `order_edit_id` | Update order edit |
| `delete_order_edit` | `order_edit_id` | Delete order edit |
| `complete_order_edit` | `order_edit_id` | Complete order edit |
| `cancel_order_edit` | `order_edit_id` | Cancel order edit |

### manage_medusa_admin_gift_cards

Gift card operations.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List gift cards |
| `get` | `id` | Get gift card |
| `create` | `value`, `region_id` | Create gift card |
| `update` | `id` | Update gift card |
| `delete` | `id` | Delete gift card |

### manage_medusa_admin_taxes

Tax management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_tax_rates` | - | List tax rates |
| `get_tax_rate` | `id` | Get tax rate |
| `create_tax_rate` | `name`, `rate` | Create tax rate |
| `update_tax_rate` | `id` | Update tax rate |
| `delete_tax_rate` | `id` | Delete tax rate |
| `list_tax_regions` | - | List tax regions |
| `get_tax_region` | `tax_region_id` | Get tax region |
| `create_tax_region` | `country_code` | Create tax region |
| `update_tax_region` | `tax_region_id` | Update tax region |
| `delete_tax_region` | `tax_region_id` | Delete tax region |

### manage_medusa_admin_sales_channels

Sales channel management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List sales channels |
| `get` | `id` | Get sales channel |
| `create` | `name` | Create sales channel |
| `update` | `id` | Update sales channel |
| `delete` | `id` | Delete sales channel |
| `add_products` | `id`, `product_ids` | Add products |
| `remove_products` | `id`, `product_ids` | Remove products |
| `list_products` | `id` | List products in channel |

### manage_medusa_admin_users

User and authentication management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list_users` | - | List users |
| `get_user` | `id` | Get user |
| `create_user` | `email` | Create user |
| `update_user` | `id` | Update user |
| `delete_user` | `id` | Delete user |
| `list_invites` | - | List invites |
| `get_invite` | `invite_id` | Get invite |
| `create_invite` | `email`, `role` | Create invite |
| `delete_invite` | `invite_id` | Delete invite |
| `resend_invite` | `invite_id` | Resend invite |
| `list_api_keys` | - | List API keys |
| `get_api_key` | `api_key_id` | Get API key |
| `create_api_key` | `title`, `type` | Create API key |
| `update_api_key` | `api_key_id` | Update API key |
| `delete_api_key` | `api_key_id` | Delete API key |
| `revoke_api_key` | `api_key_id` | Revoke API key |

### manage_medusa_admin_draft_orders

Draft order (cart-like) operations.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `create` | `region_id` | Create draft order |
| `list` | - | List draft orders |
| `get` | `id` | Get draft order |
| `delete` | `id` | Delete draft order |
| `convert_to_order` | `id` | Convert to order |
| `add_line_item` | `id`, `variant_id`, `quantity` | Add line item |
| `update_line_item` | `id`, `line_id` | Update line item |
| `remove_line_item` | `id`, `line_id` | Remove line item |

### manage_medusa_admin_collections

Collection management.

**Actions:**

| Action | Required Params | Description |
|--------|-----------------|-------------|
| `list` | - | List collections |
| `get` | `id` | Get collection |
| `create` | `title` | Create collection |
| `update` | `id` | Update collection |
| `delete` | `id` | Delete collection |
| `add_products` | `id`, `product_ids` | Add products |
| `remove_products` | `id`, `product_ids` | Remove products |
| `list_products` | `id` | List products in collection |

## Error Codes

### JSON-RPC Errors

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC |
| -32601 | Method not found | Unknown method |
| -32602 | Invalid params | Invalid parameters |
| -32603 | Internal error | Server error |

### HTTP Errors

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Missing or invalid token |
| 404 | Not Found - Unknown endpoint |
| 405 | Method Not Allowed |
| 500 | Internal Server Error |

## Rate Limits

No built-in rate limits. Implement at infrastructure level (e.g., Digital Ocean App Platform, Cloudflare).

Recommended limits:
- 100 requests per minute per token
- 1000 requests per hour per token
