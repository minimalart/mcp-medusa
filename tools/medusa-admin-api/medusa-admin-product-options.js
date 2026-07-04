/**
 * Medusa 2.17 product option management.
 *
 * Medusa exposes reusable product option reads through the Store API and product
 * option mutations through product-scoped Admin API routes. `is_exclusive:false`
 * creates an option that can be reused across products.
 */

import { buildMedusaUrl, makeRequest } from "../../lib/medusa-client.js";

function optionPayload(args, includeMetadata = false) {
  const body = {};
  if (typeof args.title === "string") body.title = args.title;
  if (Array.isArray(args.values)) body.values = args.values;
  if (args.ranks && typeof args.ranks === "object") body.ranks = args.ranks;
  if (typeof args.is_exclusive === "boolean") body.is_exclusive = args.is_exclusive;
  if (includeMetadata && args.metadata && typeof args.metadata === "object") {
    body.metadata = args.metadata;
  }
  return body;
}

function productOptionPath(productId, optionId = "") {
  if (!productId) {
    throw new Error("product_id is required for product option write actions.");
  }
  return `/admin/products/${encodeURIComponent(productId)}/options${
    optionId ? `/${encodeURIComponent(optionId)}` : ""
  }`;
}

async function executeFunction(args = {}) {
  const { action, option_id: optionId, product_id: productId, query = {} } = args;

  switch (action) {
    case "list": {
      const url = buildMedusaUrl("/store/product-options", {
        limit: args.limit,
        offset: args.offset,
        q: args.q,
        id: args.id,
        title: args.title,
        fields: args.fields,
      });
      return await makeRequest(url, { method: "GET" });
    }
    case "get": {
      if (!optionId) {
        return { error: "option_id is required for get actions." };
      }
      const url = buildMedusaUrl(`/store/product-options/${encodeURIComponent(optionId)}`, {
        fields: args.fields,
      });
      return await makeRequest(url, { method: "GET" });
    }
    case "create": {
      const url = buildMedusaUrl(productOptionPath(productId), query);
      return await makeRequest(url, {
        method: "POST",
        body: JSON.stringify(optionPayload(args)),
      });
    }
    case "update": {
      if (!optionId) {
        return { error: "option_id is required for update actions." };
      }
      const url = buildMedusaUrl(productOptionPath(productId, optionId), query);
      return await makeRequest(url, {
        method: "POST",
        body: JSON.stringify(optionPayload(args, true)),
      });
    }
    case "delete": {
      if (!optionId) {
        return { error: "option_id is required for delete actions." };
      }
      const url = buildMedusaUrl(productOptionPath(productId, optionId));
      return await makeRequest(url, { method: "DELETE" });
    }
    case "link_to_product": {
      const url = buildMedusaUrl(`${productOptionPath(productId)}/batch`, query);
      return await makeRequest(url, {
        method: "POST",
        body: JSON.stringify({
          add: args.add,
          remove: args.remove,
          update: args.update,
        }),
      });
    }
    default:
      return {
        error:
          "Invalid action. Valid actions are: list, get, create, update, delete, link_to_product",
      };
  }
}

const apiTool = {
  definition: {
    name: "manage_medusa_admin_product_options",
    title: "Product Options",
    description:
      "Manage Medusa 2.17 reusable product options: list/retrieve options, create or update product-scoped options, delete options from products, and link reusable options to products.",
    parameters: {
      type: "object",
      properties: {
        resource: {
          type: "string",
          enum: ["product_options"],
          description: "Resource guard for policy routing.",
        },
        action: {
          type: "string",
          enum: ["list", "get", "create", "update", "delete", "link_to_product"],
          description: "The product option operation to perform.",
        },
        product_id: {
          type: "string",
          description:
            "Product ID required for create, update, delete, and link_to_product actions.",
        },
        option_id: {
          type: "string",
          description: "Product option ID required for get, update, and delete actions.",
        },
        title: {
          type: "string",
          description: "Product option title or title filter.",
        },
        values: {
          type: "array",
          items: { type: "string" },
          description: "Option values for create/update actions.",
        },
        ranks: {
          type: "object",
          description: "Map of option value to rank, supported since Medusa 2.16.",
        },
        is_exclusive: {
          type: "boolean",
          description:
            "Whether the option is product-exclusive. Use false for reusable/global options.",
        },
        metadata: {
          type: "object",
          description: "Metadata for update actions.",
        },
        add: {
          type: "array",
          items: {},
          description:
            "link_to_product additions: option IDs, {id,value_ids}, or new option payloads.",
        },
        remove: {
          type: "array",
          items: { type: "string" },
          description: "Option IDs to remove from a product in link_to_product.",
        },
        update: {
          type: "array",
          items: { type: "object" },
          description: "Option value updates for link_to_product.",
        },
        limit: {
          type: "number",
          description: "Maximum number of options to return.",
        },
        offset: {
          type: "number",
          description: "Number of options to skip.",
        },
        q: {
          type: "string",
          description: "Search query.",
        },
        fields: {
          type: "string",
          description: "Fields selector, for example id,title,values.value.",
        },
        query: {
          type: "object",
          description: "Additional Admin API query parameters for write actions.",
        },
      },
      required: ["action"],
    },
  },
  function: executeFunction,
};

export { apiTool };
