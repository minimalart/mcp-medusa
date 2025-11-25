import { z } from 'zod';
// Base schemas for common parameters
const BaseListSchema = z.object({
    limit: z.number().optional().describe('Maximum number of items to return (default: 20)'),
    offset: z.number().optional().describe('Number of items to skip (default: 0)'),
    q: z.string().optional().describe('Search query string'),
});
const BaseIdSchema = z.object({
    id: z.string().describe('ID of the resource'),
});
const BaseMetadataSchema = z.object({
    metadata: z.record(z.any()).optional().describe('Additional metadata'),
});
// Orders tool schema
export const OrdersSchema = z.object({
    action: z.enum(['list', 'get', 'cancel', 'complete', 'archive', 'transfer', 'list_fulfillments', 'cancel_fulfillment'])
        .describe('The action to perform on orders.'),
    id: z.string().optional().describe('Order ID (required for get, cancel, complete, archive, transfer, list_fulfillments, cancel_fulfillment actions).'),
    limit: z.number().optional().describe('Maximum number of orders to return (default: 20).'),
    offset: z.number().optional().describe('Number of orders to skip (default: 0).'),
    status: z.string().optional().describe('Filter by order status.'),
    fulfillment_status: z.string().optional().describe('Filter by fulfillment status.'),
    payment_status: z.string().optional().describe('Filter by payment status.'),
    display_id: z.string().optional().describe('Filter by display ID.'),
    cart_id: z.string().optional().describe('Filter by cart ID.'),
    customer_id: z.string().optional().describe('Filter by customer ID or customer ID to transfer to (for transfer action).'),
    email: z.string().optional().describe('Filter by customer email.'),
    region_id: z.string().optional().describe('Filter by region ID.'),
    currency_code: z.string().optional().describe('Filter by currency code.'),
    tax_rate: z.string().optional().describe('Filter by tax rate.'),
    created_at: z.string().optional().describe('Filter by creation date.'),
    updated_at: z.string().optional().describe('Filter by update date.'),
    fulfillment_id: z.string().optional().describe('Fulfillment ID (required for cancel_fulfillment action).'),
});
// Draft Orders tool schema
export const DraftOrdersSchema = z.object({
    action: z.enum(['create', 'list', 'get', 'delete', 'convert_to_order', 'add_line_item', 'update_line_item', 'remove_line_item'])
        .describe('The action to perform on draft orders.'),
    id: z.string().optional().describe('Draft order ID (required for get, delete, convert_to_order, add_line_item, update_line_item, remove_line_item actions).'),
    limit: z.number().optional().describe('Maximum number of draft orders to return (default: 20).'),
    offset: z.number().optional().describe('Number of draft orders to skip (default: 0).'),
    q: z.string().optional().describe('Query string for search.'),
    status: z.string().optional().describe('Draft order status.'),
    email: z.string().optional().describe('Customer email.'),
    customer_id: z.string().optional().describe('Customer ID.'),
    region_id: z.string().optional().describe('Region ID.'),
    currency_code: z.string().optional().describe('Currency code.'),
    shipping_address: z.record(z.any()).optional().describe('Shipping address object.'),
    billing_address: z.record(z.any()).optional().describe('Billing address object.'),
    items: z.array(z.object({
        variant_id: z.string(),
        quantity: z.number()
    })).optional().describe('Array of line items for draft order creation.'),
    discounts: z.array(z.string()).optional().describe('Array of discount codes.'),
    line_id: z.string().optional().describe('Line item ID (required for update_line_item and remove_line_item actions).'),
    variant_id: z.string().optional().describe('Product variant ID (required for add_line_item action).'),
    quantity: z.number().optional().describe('Quantity (required for add_line_item action, optional for update_line_item).'),
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
    status: z.string().optional().describe('Filter by product status.'),
    type: z.string().optional().describe('Product type.'),
    tags: z.array(z.string()).optional().describe('Product tags.'),
    categories: z.array(z.string()).optional().describe('Product categories.'),
    images: z.array(z.record(z.any())).optional().describe('Product images.'),
    options: z.array(z.record(z.any())).optional().describe('Product options.'),
    variants: z.array(z.record(z.any())).optional().describe('Product variants.'),
    variant_data: z.record(z.any()).optional().describe('Variant data for create/update operations.'),
    category_id: z.array(z.string()).optional().describe('Filter by category IDs.'),
    tag_id: z.array(z.string()).optional().describe('Filter by tag IDs.'),
    type_id: z.array(z.string()).optional().describe('Filter by type IDs.'),
    collection_id: z.array(z.string()).optional().describe('Filter by collection IDs.'),
    created_at: z.string().optional().describe('Filter by creation date.'),
    updated_at: z.string().optional().describe('Filter by update date.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
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
    address_data: z.record(z.any()).optional().describe('Address data for create/update operations.'),
    group_id: z.string().optional().describe('Customer group ID (required for group operations).'),
    group_name: z.string().optional().describe('Customer group name.'),
    group_metadata: z.record(z.any()).optional().describe('Customer group metadata.'),
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
    action: z.enum(['list_items', 'get_item', 'create_item', 'update_item', 'delete_item', 'list_locations', 'get_location', 'create_location', 'update_location', 'delete_location', 'list_levels', 'update_level', 'list_reservations', 'create_reservation', 'update_reservation', 'delete_reservation'])
        .describe('The action to perform on inventory.'),
    id: z.string().optional().describe('Inventory item ID.'),
    sku: z.string().optional().describe('Inventory item SKU.'),
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
    address: z.record(z.any()).optional().describe('Location address.'),
    inventory_item_id: z.string().optional().describe('Inventory item ID for levels/reservations.'),
    stocked_quantity: z.number().optional().describe('Stocked quantity.'),
    incoming_quantity: z.number().optional().describe('Incoming quantity.'),
    reservation_id: z.string().optional().describe('Reservation ID.'),
    line_item_id: z.string().optional().describe('Line item ID for reservations.'),
    quantity: z.number().optional().describe('Reservation quantity.'),
    description: z.string().optional().describe('Reservation description.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
// Regions tool schema
export const RegionsSchema = z.object({
    action: z.enum(['list_regions', 'get_region', 'create_region', 'update_region', 'delete_region', 'list_shipping_options', 'get_shipping_option', 'create_shipping_option', 'update_shipping_option', 'delete_shipping_option', 'list_shipping_profiles', 'get_shipping_profile', 'create_shipping_profile', 'update_shipping_profile', 'delete_shipping_profile', 'list_fulfillment_providers', 'list_fulfillment_sets', 'create_fulfillment_set', 'update_fulfillment_set', 'delete_fulfillment_set'])
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
    provider_id: z.string().optional().describe('Provider ID.'),
    price_type: z.string().optional().describe('Price type (flat_rate, calculated).'),
    amount: z.number().optional().describe('Price amount.'),
    admin_only: z.boolean().optional().describe('Whether option is admin only.'),
    is_return: z.boolean().optional().describe('Whether this is a return option.'),
    profile_id: z.string().optional().describe('Shipping profile ID.'),
    type: z.string().optional().describe('Profile/set type.'),
    data: z.record(z.any()).optional().describe('Additional data.'),
    fulfillment_set_id: z.string().optional().describe('Fulfillment set ID.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
// Pricing tool schema
export const PricingSchema = z.object({
    action: z.enum(['list_price_lists', 'get_price_list', 'create_price_list', 'update_price_list', 'delete_price_list', 'list_promotions', 'get_promotion', 'create_promotion', 'update_promotion', 'delete_promotion', 'list_campaigns', 'get_campaign', 'create_campaign', 'update_campaign', 'delete_campaign'])
        .describe('The action to perform.'),
    id: z.string().optional().describe('Price list ID.'),
    name: z.string().optional().describe('Name.'),
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
    rules: z.array(z.any()).optional().describe('Promotion rules.'),
    application_method: z.record(z.any()).optional().describe('Application method.'),
    campaign_id: z.string().optional().describe('Campaign ID.'),
    campaign_identifier: z.string().optional().describe('Campaign identifier.'),
    budget: z.record(z.any()).optional().describe('Campaign budget.'),
}).merge(BaseListSchema);
// Payments tool schema
export const PaymentsSchema = z.object({
    action: z.enum(['list_payment_collections', 'get_payment_collection', 'update_payment_collection', 'delete_payment_collection', 'list_payments', 'get_payment', 'capture_payment', 'cancel_payment', 'refund_payment', 'list_refunds', 'get_refund'])
        .describe('The action to perform on payments.'),
    id: z.string().optional().describe('Payment collection ID.'),
    description: z.string().optional().describe('Payment collection description.'),
    payment_collection_id: z.string().optional().describe('Payment collection ID for filtering.'),
    payment_id: z.string().optional().describe('Payment ID.'),
    amount: z.number().optional().describe('Amount for capture/refund.'),
    reason: z.string().optional().describe('Refund reason.'),
    note: z.string().optional().describe('Refund note.'),
    refund_id: z.string().optional().describe('Refund ID.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
// Returns tool schema
export const ReturnsSchema = z.object({
    action: z.enum(['list_returns', 'get_return', 'cancel_return', 'receive_return', 'list_exchanges', 'get_exchange', 'cancel_exchange', 'list_claims', 'get_claim', 'update_claim', 'cancel_claim', 'list_order_edits', 'get_order_edit', 'update_order_edit', 'delete_order_edit', 'complete_order_edit', 'cancel_order_edit'])
        .describe('The action to perform.'),
    id: z.string().optional().describe('Return ID.'),
    order_id: z.string().optional().describe('Order ID for filtering.'),
    items: z.array(z.any()).optional().describe('Items to receive/return.'),
    refund: z.number().optional().describe('Refund amount.'),
    shipping_methods: z.array(z.any()).optional().describe('Shipping methods.'),
    exchange_id: z.string().optional().describe('Exchange ID.'),
    claim_id: z.string().optional().describe('Claim ID.'),
    claim_items: z.array(z.any()).optional().describe('Claim items.'),
    order_edit_id: z.string().optional().describe('Order edit ID.'),
    internal_note: z.string().optional().describe('Internal note for order edit.'),
    no_notification: z.boolean().optional().describe('Whether to skip notifications.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
// Gift Cards tool schema
export const GiftCardsSchema = z.object({
    action: z.enum(['list', 'get', 'create', 'update', 'delete'])
        .describe('The action to perform on gift cards.'),
    id: z.string().optional().describe('Gift card ID.'),
    type: z.string().optional().describe('Gift card type.'),
    value: z.number().optional().describe('Gift card value.'),
    balance: z.number().optional().describe('Gift card balance.'),
    region_id: z.string().optional().describe('Region ID.'),
    is_disabled: z.boolean().optional().describe('Whether gift card is disabled.'),
    ends_at: z.string().optional().describe('Expiration date.'),
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
    default_tax_rate: z.record(z.any()).optional().describe('Default tax rate configuration.'),
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
    action: z.enum(['list_users', 'get_user', 'create_user', 'update_user', 'delete_user', 'list_invites', 'get_invite', 'create_invite', 'delete_invite', 'resend_invite', 'list_api_keys', 'get_api_key', 'create_api_key', 'update_api_key', 'delete_api_key', 'revoke_api_key'])
        .describe('The action to perform.'),
    id: z.string().optional().describe('User ID.'),
    email: z.string().optional().describe('User/invite email.'),
    first_name: z.string().optional().describe('User first name.'),
    last_name: z.string().optional().describe('User last name.'),
    role: z.string().optional().describe('User/invite role.'),
    invite_id: z.string().optional().describe('Invite ID.'),
    api_key_id: z.string().optional().describe('API key ID.'),
    title: z.string().optional().describe('API key title.'),
    type: z.string().optional().describe('API key type.'),
}).merge(BaseListSchema).merge(BaseMetadataSchema);
// Export all schemas in a map for easy access
export const ToolSchemas = {
    'manage_medusa_admin_orders': OrdersSchema,
    'manage_medusa_admin_draft_orders': DraftOrdersSchema,
    'manage_medusa_admin_products': ProductsSchema,
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
};
