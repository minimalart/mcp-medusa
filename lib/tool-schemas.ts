import { z } from 'zod';

// Base schemas for common parameters
const BaseListSchema = z.object({
  limit: z.number().optional().describe('Maximum number of items to return (default: 20)'),
  offset: z.number().optional().describe('Number of items to skip (default: 0)'),
  q: z.string().optional().describe('Search query string'),
  fields: z.string().optional().describe('Medusa v2 fields selector, including relation selectors such as *variants'),
  order: z.string().optional().describe('Sort order, for example created_at or -created_at'),
});

const BaseIdSchema = z.object({
  id: z.string().describe('ID of the resource'),
});

const BaseMetadataSchema = z.object({
  metadata: z.record(z.string(), z.any()).optional().describe('Additional metadata'),
});

// Date filters accept an ISO string or a Medusa operator map ({ $gte, $lte, $gt, $lt }).
const DateFilterSchema = z.union([z.string(), z.record(z.string(), z.any())]);

const ItemQuantitySchema = z.object({
  id: z.string().describe('Order line item ID'),
  quantity: z.number().describe('Quantity'),
});

// Orders tool schema
export const OrdersSchema = z.object({
  action: z.enum(['list', 'get', 'cancel', 'complete', 'archive', 'transfer', 'transfer_to_guest', 'cancel_transfer', 'list_fulfillments', 'create_fulfillment', 'create_shipment', 'mark_as_delivered', 'cancel_fulfillment'])
    .describe('The action to perform on orders.'),
  id: z.string().optional().describe('Order ID (required for every action except list).'),
  limit: z.number().optional().describe('Maximum number of orders to return (default: 20).'),
  offset: z.number().optional().describe('Number of orders to skip (default: 0).'),
  status: z.string().optional().describe('Filter by order status.'),
  fulfillment_status: z.string().optional().describe('Filter by fulfillment status.'),
  payment_status: z.string().optional().describe('Filter by payment status.'),
  display_id: z.string().optional().describe('Filter by display ID.'),
  cart_id: z.string().optional().describe('Filter by cart ID.'),
  customer_id: z.string().optional().describe('Filter by customer ID or customer ID to transfer to (for transfer action).'),
  email: z.string().optional().describe('Filter by customer email, or the guest email for transfer_to_guest.'),
  region_id: z.string().optional().describe('Filter by region ID.'),
  currency_code: z.string().optional().describe('Filter by currency code.'),
  tax_rate: z.string().optional().describe('Filter by tax rate.'),
  created_at: DateFilterSchema.optional().describe('Filter by creation date (ISO string or {$gte,$lte,$gt,$lt}).'),
  updated_at: DateFilterSchema.optional().describe('Filter by update date (ISO string or {$gte,$lte,$gt,$lt}).'),
  fields: z.string().optional().describe('Fields selector.'),
  description: z.string().optional().describe('Transfer description (transfer, transfer_to_guest).'),
  internal_note: z.string().optional().describe('Internal note (transfer, transfer_to_guest).'),
  update_order_email: z.boolean().optional().describe('transfer: also update the order email.'),
  fulfillment_id: z.string().optional().describe('Fulfillment ID (create_shipment, mark_as_delivered, cancel_fulfillment).'),
  items: z.array(ItemQuantitySchema).optional().describe('create_fulfillment / create_shipment items.'),
  location_id: z.string().optional().describe('create_fulfillment: stock location ID.'),
  shipping_option_id: z.string().optional().describe('create_fulfillment: shipping option ID.'),
  delivery_address: z.record(z.string(), z.any()).optional().describe('create_fulfillment: delivery address (Medusa >= 2.19).'),
  labels: z.array(z.record(z.string(), z.any())).optional().describe('create_shipment: [{ tracking_number, tracking_url, label_url }].'),
  no_notification: z.boolean().optional().describe('Do not notify the customer.'),
  metadata: z.record(z.string(), z.any()).optional().describe('Fulfillment/shipment metadata.'),
  additional_data: z.record(z.string(), z.any()).optional().describe('Additional data for workflow hooks.'),
});

// Draft Orders tool schema
export const DraftOrdersSchema = z.object({
  action: z.enum([
    'create', 'list', 'get', 'update', 'delete', 'convert_to_order',
    'add_line_item', 'update_line_item', 'remove_line_item',
    'begin_edit', 'edit_add_items', 'edit_update_item', 'edit_remove_item', 'edit_remove_added_item',
    'edit_add_promotions', 'edit_remove_promotions', 'edit_add_shipping_method', 'edit_remove_shipping_method',
    'request_edit', 'confirm_edit', 'cancel_edit',
  ]).describe('The action to perform on draft orders.'),
  id: z.string().optional().describe('Draft order ID (required for every action except create and list).'),
  limit: z.number().optional().describe('Maximum number of draft orders to return (default: 50).'),
  offset: z.number().optional().describe('Number of draft orders to skip (default: 0).'),
  q: z.string().optional().describe('Query string for search.'),
  fields: z.string().optional().describe('Fields selector for get/list/convert_to_order.'),
  status: z.string().optional().describe('Draft order status on create (only "completed").'),
  email: z.string().optional().describe('Customer email.'),
  customer_id: z.string().optional().describe('Customer ID.'),
  region_id: z.string().optional().describe('Region ID (required for create).'),
  sales_channel_id: z.string().optional().describe('Sales channel ID.'),
  currency_code: z.string().optional().describe('Currency code.'),
  locale: z.string().optional().describe('Locale.'),
  shipping_address: z.record(z.string(), z.any()).optional().describe('Shipping address object.'),
  billing_address: z.record(z.string(), z.any()).optional().describe('Billing address object.'),
  shipping_methods: z.array(z.record(z.string(), z.any())).optional().describe('Shipping methods on create.'),
  items: z.array(z.object({
    variant_id: z.string().optional(),
    title: z.string().optional(),
    quantity: z.number(),
    unit_price: z.number().optional(),
    compare_at_unit_price: z.number().optional(),
    internal_note: z.string().optional(),
    allow_backorder: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).passthrough()).optional().describe('Line items for create or edit_add_items.'),
  promo_codes: z.array(z.string()).optional().describe('Promotion codes (create, edit_add_promotions, edit_remove_promotions).'),
  discounts: z.array(z.string()).optional().describe('Deprecated alias of promo_codes.'),
  no_notification_order: z.boolean().optional().describe('Create: do not notify the customer about the resulting order.'),
  line_id: z.string().optional().describe('Existing line item ID (update_line_item, remove_line_item, edit_update_item, edit_remove_item).'),
  item_id: z.string().optional().describe('Alias of line_id.'),
  action_id: z.string().optional().describe('Order change action ID of an item added in the current edit.'),
  variant_id: z.string().optional().describe('Product variant ID (add_line_item / edit_add_items shortcut).'),
  title: z.string().optional().describe('Custom item title.'),
  quantity: z.number().optional().describe('Quantity (0 removes an existing item in edit_update_item).'),
  unit_price: z.number().optional().describe('Custom unit price.'),
  compare_at_unit_price: z.number().optional().describe('Compare-at unit price.'),
  internal_note: z.string().optional().describe('Internal note.'),
  allow_backorder: z.boolean().optional().describe('Allow backorder for added items.'),
  shipping_option_id: z.string().optional().describe('Shipping option ID (edit_add_shipping_method).'),
  custom_amount: z.number().optional().describe('Custom shipping amount.'),
  description: z.string().optional().describe('Shipping method description.'),
  method_id: z.string().optional().describe('Existing shipping method ID (edit_remove_shipping_method).'),
}).merge(BaseMetadataSchema);

// Products tool schema
export const ProductsSchema = z.object({
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'list_variants', 'get_variant', 'create_variant', 'update_variant', 'delete_variant', 'list_categories', 'get_category', 'create_category', 'update_category', 'delete_category', 'list_tags', 'list_types'])
    .describe('The action to perform on products.'),
  id: z.string().optional().describe('Product/Category ID (required for get, update, delete, variants operations).'),
  variant_id: z.string().optional().describe('Product variant ID (required for variant-specific operations).'),
  title: z.string().optional().describe('Product title.'),
  subtitle: z.string().optional().describe('Product subtitle.'),
  description: z.string().optional().describe('Product description.'),
  handle: z.string().optional().describe('Product handle/slug.'),
  status: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by product status. Medusa v2 expects an array; a string is accepted and normalized.'),
  type: z.string().optional().describe('Product type.'),
  tags: z.array(z.string()).optional().describe('Product tags.'),
  categories: z.array(z.string()).optional().describe('Product categories.'),
  images: z.array(z.record(z.string(), z.any())).optional().describe('Product images.'),
  options: z.array(z.record(z.string(), z.any())).optional().describe('Product options.'),
  variants: z.array(z.record(z.string(), z.any())).optional().describe('Product variants.'),
  variant_data: z.record(z.string(), z.any()).optional().describe('Variant data for create/update operations.'),
  category_id: z.array(z.string()).optional().describe('Filter by category IDs.'),
  tag_id: z.array(z.string()).optional().describe('Filter by tag IDs.'),
  type_id: z.array(z.string()).optional().describe('Filter by type IDs.'),
  collection_id: z.array(z.string()).optional().describe('Filter by collection IDs.'),
  created_at: z.string().optional().describe('Filter by creation date.'),
  updated_at: z.string().optional().describe('Filter by update date.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

export const ProductOptionsSchema = z.object({
  resource: z.enum(['product_options']).optional().describe('Resource guard for policy routing.'),
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'list_values', 'get_value', 'update_value', 'delete_value', 'link_to_product'])
    .describe('The product option operation to perform.'),
  product_id: z.string().optional().describe('Product ID: required for link_to_product; optional for list (product options), create (also link) and delete (unlink only).'),
  option_id: z.string().optional().describe('Product option ID required for get/update/delete and value actions.'),
  value_id: z.string().optional().describe('Product option value ID for get_value/update_value/delete_value.'),
  id: z.string().optional().describe('Filter list by option ID.'),
  title: z.string().optional().describe('Product option title or title filter.'),
  values: z.array(z.string()).optional().describe('Option values for create/update.'),
  value: z.string().optional().describe('Option value for update_value or list_values filter.'),
  ranks: z.record(z.string(), z.number()).optional().describe('Map of option value to rank.'),
  is_exclusive: z.boolean().optional().describe('false creates reusable/global options.'),
  metadata: z.record(z.string(), z.any()).optional().describe('Metadata for create/update/update_value.'),
  add: z.array(z.any()).optional().describe('Options to add in link_to_product.'),
  remove: z.array(z.string()).optional().describe('Option IDs to remove in link_to_product.'),
  update: z.array(z.record(z.string(), z.any())).optional().describe('Option value updates.'),
  query: z.record(z.string(), z.any()).optional().describe('Additional Admin API query parameters.'),
}).merge(BaseListSchema);

// Customers tool schema
export const CustomersSchema = z.object({
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'list_addresses', 'get_address', 'create_address', 'update_address', 'delete_address', 'list_groups', 'get_group', 'create_group', 'update_group', 'delete_group', 'add_to_group', 'remove_from_group'])
    .describe('The action to perform on customers.'),
  id: z.string().optional().describe('Customer ID (required for get, update, delete, address operations).'),
  email: z.string().optional().describe('Customer email address.'),
  first_name: z.string().optional().describe('Customer first name.'),
  last_name: z.string().optional().describe('Customer last name.'),
  phone: z.string().optional().describe('Customer phone number.'),
  address_id: z.string().optional().describe('Address ID (required for address-specific operations).'),
  address_data: z.record(z.string(), z.any()).optional().describe('Address data for create/update operations.'),
  group_id: z.string().optional().describe('Customer group ID (required for group operations).'),
  group_name: z.string().optional().describe('Customer group name.'),
  group_metadata: z.record(z.string(), z.any()).optional().describe('Customer group metadata.'),
  created_at: z.string().optional().describe('Filter by creation date.'),
  updated_at: z.string().optional().describe('Filter by update date.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Collections tool schema
export const CollectionsSchema = z.object({
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'add_products', 'remove_products', 'list_products'])
    .describe('The action to perform on collections.'),
  id: z.string().optional().describe('Collection ID (required for get, update, delete, product operations).'),
  title: z.string().optional().describe('Collection title.'),
  handle: z.string().optional().describe('Collection handle/slug.'),
  product_ids: z.array(z.string()).optional().describe('Product IDs to add/remove from collection.'),
  created_at: z.string().optional().describe('Filter by creation date.'),
  updated_at: z.string().optional().describe('Filter by update date.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Inventory tool schema
export const InventorySchema = z.object({
  action: z.enum(['list_items', 'get_item', 'create_item', 'update_item', 'delete_item', 'export_items', 'list_locations', 'get_location', 'create_location', 'update_location', 'delete_location', 'list_levels', 'update_level', 'list_reservations', 'create_reservation', 'update_reservation', 'delete_reservation'])
    .describe('The action to perform on inventory.'),
  id: z.string().optional().describe('Inventory item ID.'),
  sku: z.string().optional().describe('Inventory item SKU.'),
  title: z.string().optional().describe('Inventory item title.'),
  thumbnail: z.string().optional().describe('Inventory item thumbnail URL.'),
  requires_shipping: z.boolean().optional().describe('Whether the inventory item requires shipping.'),
  unit_of_measure: z.string().optional().describe('Unit of measure, e.g. kg (Medusa >= 2.20; only sent when provided).'),
  location_levels: z.array(z.record(z.string(), z.any())).optional().describe('create_item: initial stock per location.'),
  weight: z.number().optional().describe('Item weight.'),
  length: z.number().optional().describe('Item length.'),
  height: z.number().optional().describe('Item height.'),
  width: z.number().optional().describe('Item width.'),
  origin_country: z.string().optional().describe('Origin country code.'),
  hs_code: z.string().optional().describe('Harmonized System code.'),
  mid_code: z.string().optional().describe('MID code.'),
  material: z.string().optional().describe('Item material.'),
  location_id: z.string().optional().describe('Stock location ID.'),
  name: z.string().optional().describe('Stock location name.'),
  address: z.record(z.string(), z.any()).optional().describe('Location address.'),
  inventory_item_id: z.string().optional().describe('Inventory item ID for levels/reservations.'),
  stocked_quantity: z.number().optional().describe('Stocked quantity (fractional on Medusa >= 2.20).'),
  incoming_quantity: z.number().optional().describe('Incoming quantity (fractional on Medusa >= 2.20).'),
  reservation_id: z.string().optional().describe('Reservation ID.'),
  line_item_id: z.string().optional().describe('Line item ID for reservations.'),
  quantity: z.number().optional().describe('Reservation quantity (fractional on Medusa >= 2.20).'),
  description: z.string().optional().describe('Reservation or inventory item description.'),
  query: z.record(z.string(), z.any()).optional().describe('export_items: extra list filters sent as query params.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Regions tool schema
export const RegionsSchema = z.object({
  action: z.enum(['list_regions', 'get_region', 'create_region', 'update_region', 'delete_region', 'list_shipping_options', 'get_shipping_option', 'create_shipping_option', 'update_shipping_option', 'delete_shipping_option', 'list_shipping_profiles', 'get_shipping_profile', 'create_shipping_profile', 'update_shipping_profile', 'delete_shipping_profile', 'list_fulfillment_providers', 'list_fulfillment_sets', 'create_fulfillment_set', 'delete_fulfillment_set', 'create_service_zone', 'get_service_zone', 'update_service_zone', 'delete_service_zone'])
    .describe('The action to perform.'),
  id: z.string().optional().describe('Region ID.'),
  name: z.string().optional().describe('Name.'),
  currency_code: z.string().optional().describe('Currency code.'),
  tax_rate: z.number().optional().describe('Tax rate.'),
  tax_code: z.string().optional().describe('Tax code.'),
  countries: z.array(z.string()).optional().describe('Country codes.'),
  payment_providers: z.array(z.string()).optional().describe('Payment provider IDs.'),
  fulfillment_providers: z.array(z.string()).optional().describe('Fulfillment provider IDs.'),
  includes_tax: z.boolean().optional().describe('Whether prices include tax.'),
  shipping_option_id: z.string().optional().describe('Shipping option ID.'),
  region_id: z.string().optional().describe('Region ID for shipping options.'),
  service_zone_id: z.string().optional().describe('Service zone ID (service zone actions and create_shipping_option).'),
  provider_id: z.string().optional().describe('Provider ID.'),
  price_type: z.string().optional().describe('Price type (flat, calculated).'),
  amount: z.number().optional().describe('Price amount.'),
  admin_only: z.boolean().optional().describe('Whether option is admin only.'),
  is_return: z.boolean().optional().describe('Whether this is a return option.'),
  profile_id: z.string().optional().describe('Shipping profile ID.'),
  type: z.string().optional().describe('Shipping profile type or fulfillment set type (shipping, pickup).'),
  data: z.record(z.string(), z.any()).optional().describe('Additional data.'),
  fulfillment_set_id: z.string().optional().describe('Fulfillment set ID.'),
  location_id: z.string().optional().describe('Stock location ID (create_fulfillment_set, list_fulfillment_sets filter).'),
  geo_zones: z.array(z.record(z.string(), z.any())).optional().describe('Service zone geo zones.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Pricing tool schema
export const PricingSchema = z.object({
  action: z.enum(['list_price_lists', 'get_price_list', 'create_price_list', 'update_price_list', 'delete_price_list', 'list_promotions', 'get_promotion', 'create_promotion', 'update_promotion', 'delete_promotion', 'list_campaigns', 'get_campaign', 'create_campaign', 'update_campaign', 'delete_campaign'])
    .describe('The action to perform.'),
  id: z.string().optional().describe('Price list ID.'),
  name: z.string().optional().describe('Name.'),
  title: z.string().optional().describe('Price list title. Preferred over name for price list actions.'),
  description: z.string().optional().describe('Description.'),
  type: z.string().optional().describe('Type.'),
  status: z.string().optional().describe('Status.'),
  starts_at: z.string().optional().describe('Start date.'),
  ends_at: z.string().optional().describe('End date.'),
  customer_groups: z.array(z.any()).optional().describe('Customer groups.'),
  prices: z.array(z.any()).optional().describe('Price list prices.'),
  promotion_id: z.string().optional().describe('Promotion ID.'),
  code: z.string().optional().describe('Promotion code.'),
  is_automatic: z.boolean().optional().describe('Whether promotion is automatic.'),
  is_tax_inclusive: z.boolean().optional().describe('Whether the promotion value includes tax.'),
  rules: z.array(z.any()).optional().describe('Promotion rules.'),
  application_method: z.record(z.string(), z.any()).optional().describe('Application method.'),
  campaign_id: z.string().optional().describe('Campaign ID.'),
  campaign_identifier: z.string().optional().describe('Campaign identifier.'),
  budget: z.record(z.string(), z.any()).optional().describe('Campaign budget.'),
  metadata: z.record(z.string(), z.any()).optional().describe('Promotion metadata (Medusa >= 2.21; only sent when provided).'),
}).merge(BaseListSchema);

// Payments tool schema
export const PaymentsSchema = z.object({
  action: z.enum(['list_payment_collections', 'get_payment_collection', 'create_payment_collection', 'mark_payment_collection_as_paid', 'create_payment_session', 'delete_payment_collection', 'list_payments', 'get_payment', 'capture_payment', 'refund_payment', 'list_refunds', 'get_refund', 'list_payment_providers', 'list_refund_reasons'])
    .describe('The action to perform on payments.'),
  id: z.string().optional().describe('Payment collection ID.'),
  order_id: z.string().optional().describe('Order ID (payment collections are read from their order).'),
  payment_collection_id: z.string().optional().describe('Payment collection filter for list_payments (requires order_id).'),
  payment_session_id: z.string().optional().describe('Payment session filter for list_payments.'),
  payment_id: z.string().optional().describe('Payment ID.'),
  provider_id: z.string().optional().describe('Payment provider ID.'),
  is_enabled: z.boolean().optional().describe('Filter payment providers by enabled state.'),
  data: z.record(z.string(), z.any()).optional().describe('Provider data for create_payment_session.'),
  amount: z.number().optional().describe('Amount (> 0 for capture/refund; required for refund and create_payment_collection).'),
  refund_reason_id: z.string().optional().describe('Refund reason ID.'),
  reason: z.string().optional().describe('Deprecated free-text refund reason (appended to note).'),
  note: z.string().optional().describe('Refund note.'),
  refund_id: z.string().optional().describe('Refund ID.'),
  created_at: DateFilterSchema.optional().describe('Date filter for list_payments.'),
  updated_at: DateFilterSchema.optional().describe('Date filter for list_payments.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Returns tool schema
export const ReturnsSchema = z.object({
  action: z.enum(['list_returns', 'get_return', 'cancel_return', 'receive_return', 'list_exchanges', 'get_exchange', 'cancel_exchange', 'list_claims', 'get_claim', 'cancel_claim', 'list_order_edits', 'get_order_edit', 'create_order_edit', 'order_edit_add_items', 'order_edit_update_item', 'order_edit_update_added_item', 'order_edit_remove_added_item', 'order_edit_add_shipping_method', 'order_edit_update_shipping_method', 'order_edit_remove_shipping_method', 'request_order_edit', 'confirm_order_edit', 'complete_order_edit', 'cancel_order_edit', 'delete_order_edit'])
    .describe('The action to perform.'),
  id: z.string().optional().describe('Return ID.'),
  order_id: z.string().optional().describe('Order ID (filter for list actions; required for order edit actions).'),
  items: z.array(z.any()).optional().describe('receive_return items [{ id, quantity }] or order_edit_add_items items [{ variant_id, quantity }].'),
  refund: z.number().optional().describe('Unsupported in Medusa v2 (use payments refund_payment).'),
  exchange_id: z.string().optional().describe('Exchange ID.'),
  claim_id: z.string().optional().describe('Claim ID.'),
  order_edit_id: z.string().optional().describe('Deprecated: order edits are addressed by order_id.'),
  item_id: z.string().optional().describe('Existing order line item ID (order_edit_update_item).'),
  action_id: z.string().optional().describe('Order change action ID (added item or shipping method).'),
  variant_id: z.string().optional().describe('Variant ID for order_edit_add_items.'),
  quantity: z.number().optional().describe('Quantity for order edit item actions.'),
  unit_price: z.number().optional().describe('Custom unit price.'),
  compare_at_unit_price: z.number().optional().describe('Compare-at unit price.'),
  allow_backorder: z.boolean().optional().describe('Allow backorder for added items.'),
  shipping_option_id: z.string().optional().describe('Shipping option ID.'),
  custom_amount: z.number().optional().describe('Custom shipping amount.'),
  description: z.string().optional().describe('Description.'),
  status: z.string().optional().describe('Order change status filter for list_order_edits.'),
  internal_note: z.string().optional().describe('Internal note.'),
  no_notification: z.boolean().optional().describe('Whether to skip notifications (request_order_edit needs Medusa >= 2.19).'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Gift Cards tool schema
export const GiftCardsSchema = z.object({
  action: z.enum(['list', 'get', 'create', 'update', 'list_orders'])
    .describe('The action to perform on gift cards.'),
  id: z.string().optional().describe('Gift card ID.'),
  code: z.string().optional().describe('Gift card code.'),
  type: z.string().optional().describe('Gift card type.'),
  value: z.number().optional().describe('Gift card value.'),
  currency_code: z.string().optional().describe('Gift card currency code.'),
  balance: z.number().optional().describe('Gift card balance.'),
  region_id: z.string().optional().describe('Region ID.'),
  is_disabled: z.boolean().optional().describe('Unsupported by the loyalty plugin.'),
  status: z.enum(['pending', 'redeemed']).optional().describe('Gift card status.'),
  note: z.string().optional().describe('Internal note.'),
  ends_at: z.string().optional().describe('Expiration date alias.'),
  expires_at: z.string().optional().describe('Expiration date.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Taxes tool schema
export const TaxesSchema = z.object({
  action: z.enum(['list_tax_rates', 'get_tax_rate', 'create_tax_rate', 'update_tax_rate', 'delete_tax_rate', 'list_tax_regions', 'get_tax_region', 'create_tax_region', 'update_tax_region', 'delete_tax_region'])
    .describe('The action to perform on taxes.'),
  id: z.string().optional().describe('Tax rate ID.'),
  code: z.string().optional().describe('Tax rate code.'),
  name: z.string().optional().describe('Tax rate name.'),
  rate: z.number().optional().describe('Tax rate percentage.'),
  is_default: z.boolean().optional().describe('Whether this is the default rate.'),
  is_combinable: z.boolean().optional().describe('Whether rate can be combined with others.'),
  tax_region_id: z.string().optional().describe('Tax region ID.'),
  country_code: z.string().optional().describe('Country code.'),
  province_code: z.string().optional().describe('Province/state code.'),
  parent_id: z.string().optional().describe('Parent tax region ID.'),
  provider_id: z.string().optional().describe('Tax provider ID, for example tp_system.'),
  default_tax_rate: z.record(z.string(), z.any()).optional().describe('Default tax rate configuration.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Sales Channels tool schema
export const SalesChannelsSchema = z.object({
  action: z.enum(['list', 'get', 'create', 'update', 'delete', 'add_products', 'remove_products', 'list_products'])
    .describe('The action to perform on sales channels.'),
  id: z.string().optional().describe('Sales channel ID.'),
  name: z.string().optional().describe('Sales channel name.'),
  description: z.string().optional().describe('Sales channel description.'),
  is_disabled: z.boolean().optional().describe('Whether channel is disabled.'),
  product_ids: z.array(z.string()).optional().describe('Product IDs to add/remove.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

// Users tool schema
export const UsersSchema = z.object({
  action: z.enum(['list_users', 'get_user', 'get_current_user', 'list_auth_providers', 'update_user', 'delete_user', 'list_invites', 'get_invite', 'create_invite', 'delete_invite', 'resend_invite', 'list_api_keys', 'get_api_key', 'create_api_key', 'update_api_key', 'delete_api_key', 'revoke_api_key'])
    .describe('The action to perform.'),
  id: z.string().optional().describe('User ID.'),
  email: z.string().optional().describe('User/invite email.'),
  first_name: z.string().optional().describe('User first name.'),
  last_name: z.string().optional().describe('User last name.'),
  avatar_url: z.string().optional().describe('User avatar URL.'),
  roles: z.array(z.string()).optional().describe('Invite roles (array of role IDs).'),
  role: z.string().optional().describe('Deprecated single invite role.'),
  invite_id: z.string().optional().describe('Invite ID.'),
  api_key_id: z.string().optional().describe('API key ID.'),
  title: z.string().optional().describe('API key title.'),
  type: z.string().optional().describe('API key type.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);

export const AdminV2Schema = z.object({
  action: z.enum([
    'list',
    'get',
    'request',
    'search',
    'list_search_indexes',
    'reindex_search_index',
    'delete_search_index',
    'create_store_credit_account',
    'credit_store_credit_account',
    'debit_store_credit_account',
    'list_store_credit_transactions',
  ]).describe('The Medusa v2 Admin API action to perform.'),
  resource: z.enum([
    'currencies',
    'feature_flags',
    'index',
    'locales',
    'mfa_factors',
    'notifications',
    'price_preferences',
    'property_labels',
    'refund_reasons',
    'return_reasons',
    'search_indexes',
    'shipping_option_types',
    'stores',
    'store_credit_accounts',
    'tax_providers',
    'translations',
    'uploads',
    'views',
    'workflow_executions',
  ]).optional().describe('Known Medusa v2 Admin API resource for list/get actions.'),
  id: z.string().optional().describe('Resource, search index or store credit account ID.'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().describe('HTTP method for request actions.'),
  path: z.string().optional().describe('Explicit /admin/* or /auth* path for request actions (sensitive paths are blocked).'),
  query: z.record(z.string(), z.any()).optional().describe('Query parameters serialized with Medusa v2 rules.'),
  body: z.record(z.string(), z.any()).optional().describe('JSON request body (POST, PUT, PATCH, DELETE).'),
  headers: z.record(z.string(), z.any()).optional().describe('Additional request headers.'),
  q: z.string().optional().describe('Search text for action=search (Medusa >= 2.19).'),
  entity: z.union([z.string(), z.array(z.string())]).optional().describe('Entities for action=search.'),
  limit: z.number().optional().describe('Page size for search/transactions.'),
  offset: z.number().optional().describe('Offset for search/transactions.'),
  since: z.string().optional().describe('reindex_search_index: ISO datetime (Medusa >= 2.21).'),
  filters: z.record(z.string(), z.any()).optional().describe('reindex_search_index filters (Medusa >= 2.21).'),
  strategy: z.enum(['swap', 'in_place']).optional().describe('reindex_search_index strategy (Medusa >= 2.21).'),
  amount: z.number().optional().describe('Store credit amount (> 0).'),
  note: z.string().optional().describe('Store credit note.'),
  currency_code: z.string().optional().describe('Store credit account currency.'),
  customer_id: z.string().optional().describe('Store credit account customer.'),
  metadata: z.record(z.string(), z.any()).optional().describe('Store credit account metadata.'),
});

// Export all schemas in a map for easy access
export const ToolSchemas = {
  'manage_medusa_admin_orders': OrdersSchema,
  'manage_medusa_admin_draft_orders': DraftOrdersSchema,
  'manage_medusa_admin_products': ProductsSchema,
  'manage_medusa_admin_product_options': ProductOptionsSchema,
  'manage_medusa_admin_customers': CustomersSchema,
  'manage_medusa_admin_collections': CollectionsSchema,
  'manage_medusa_admin_inventory': InventorySchema,
  'manage_medusa_admin_regions': RegionsSchema,
  'manage_medusa_admin_pricing': PricingSchema,
  'manage_medusa_admin_payments': PaymentsSchema,
  'manage_medusa_admin_returns': ReturnsSchema,
  'manage_medusa_admin_gift_cards': GiftCardsSchema,
  'manage_medusa_admin_taxes': TaxesSchema,
  'manage_medusa_admin_sales_channels': SalesChannelsSchema,
  'manage_medusa_admin_users': UsersSchema,
  'manage_medusa_admin_v2': AdminV2Schema,
} as const;

export type ToolName = keyof typeof ToolSchemas;
