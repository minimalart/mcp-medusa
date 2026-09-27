/**
 * Medusa product option management (reusable/global options, Medusa 2.16+).
 *
 * Rutas Admin reales (presentes desde 2.17.2, incluida 2.18.0, hasta 2.21.1):
 *   GET|POST        /admin/product-options
 *   GET|POST|DELETE /admin/product-options/{id}
 *   GET             /admin/product-options/{id}/values
 *   GET|POST|DELETE /admin/product-options/{id}/values/{value_id}
 *   GET             /admin/products/{id}/options
 *   POST            /admin/products/{id}/options/batch   (add/remove/update links; `add` también crea opciones)
 * No existen POST /admin/products/{id}/options ni /admin/products/{id}/options/{option_id}.
 * `is_exclusive:false` crea una opción reutilizable entre productos.
 */

import { buildMedusaUrl, makeRequest } from "../../lib/medusa-client.js";
import { withMedusaErrorHints } from "../../lib/medusa-version.js";

function optionPayload(args) {
  const body = {};
  if (typeof args.title === "string") body.title = args.title;
  if (Array.isArray(args.values)) body.values = args.values;
  if (args.ranks && typeof args.ranks === "object") body.ranks = args.ranks;
  if (typeof args.is_exclusive === "boolean") body.is_exclusive = args.is_exclusive;
  if (args.metadata && typeof args.metadata === "object") body.metadata = args.metadata;
  return body;
}

function optionPath(optionId, suffix = "") {
  return `/admin/product-options/${encodeURIComponent(optionId)}${suffix}`;
}

function productOptionsPath(productId, suffix = "") {
  if (!productId) {
    throw new Error("product_id is required for this action.");
  }
  return `/admin/products/${encodeURIComponent(productId)}/options${suffix}`;
}

function listQuery(args, query) {
  return {
    limit: args.limit,
    offset: args.offset,
    q: args.q,
    id: args.id,
    title: args.title,
    is_exclusive: typeof args.is_exclusive === "boolean" ? String(args.is_exclusive) : undefined,
    fields: args.fields,
    order: args.order,
    ...query,
  };
}

async function executeFunction(args = {}) {
  const { action, option_id: optionId, product_id: productId, value_id: valueId, query = {} } = args;

  switch (action) {
    case "list": {
      if (productId) {
        const url = buildMedusaUrl(productOptionsPath(productId), {
          limit: args.limit,
          offset: args.offset,
          q: args.q,
          title: args.title,
          fields: args.fields,
          ...query,
        });
        return await makeRequest(url, { method: "GET" });
      }
      const url = buildMedusaUrl("/admin/product-options", listQuery(args, query));
      return await makeRequest(url, { method: "GET" });
    }
    case "get": {
      if (!optionId) {
        return { error: "option_id is required for get actions." };
      }
      const url = buildMedusaUrl(optionPath(optionId), { fields: args.fields, ...query });
      return await makeRequest(url, { method: "GET" });
    }
    case "create": {
      const payload = optionPayload(args);
      if (!payload.title || !Array.isArray(payload.values)) {
        return { error: "title and values are required for create actions." };
      }
      if (productId) {
        // Crea la opción y la vincula al producto en un solo paso.
        const url = buildMedusaUrl(productOptionsPath(productId, "/batch"), query);
        return await makeRequest(url, {
          method: "POST",
          body: JSON.stringify({ add: [payload] }),
        });
      }
      const url = buildMedusaUrl("/admin/product-options", query);
      return await makeRequest(url, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    case "update": {
      if (!optionId) {
        return { error: "option_id is required for update actions." };
      }
      const url = buildMedusaUrl(optionPath(optionId), query);
      return await makeRequest(url, {
        method: "POST",
        body: JSON.stringify(optionPayload(args)),
      });
    }
    case "delete": {
      if (!optionId) {
        return { error: "option_id is required for delete actions." };
      }
      if (productId) {
        // Compatibilidad: con product_id, "delete" quita la opción de ese producto (no la borra globalmente).
        const url = buildMedusaUrl(productOptionsPath(productId, "/batch"), query);
        return await makeRequest(url, {
          method: "POST",
          body: JSON.stringify({ remove: [optionId] }),
        });
      }
      const url = buildMedusaUrl(optionPath(optionId));
      return await makeRequest(url, { method: "DELETE" });
    }
    case "list_values": {
      if (!optionId) {
        return { error: "option_id is required for list_values actions." };
      }
      const url = buildMedusaUrl(optionPath(optionId, "/values"), {
        limit: args.limit,
        offset: args.offset,
        q: args.q,
        value: args.value,
        fields: args.fields,
        ...query,
      });
      return await makeRequest(url, { method: "GET" });
    }
    case "get_value":
    case "update_value":
    case "delete_value": {
      if (!optionId || !valueId) {
        return { error: `option_id and value_id are required for ${action} actions.` };
      }
      const path = optionPath(optionId, `/values/${encodeURIComponent(valueId)}`);
      if (action === "get_value") {
        return await makeRequest(buildMedusaUrl(path, { fields: args.fields, ...query }), { method: "GET" });
      }
      if (action === "delete_value") {
        return await makeRequest(buildMedusaUrl(path), { method: "DELETE" });
      }
      const body = {};
      if (typeof args.value === "string") body.value = args.value;
      if (args.metadata && typeof args.metadata === "object") body.metadata = args.metadata;
      return await makeRequest(buildMedusaUrl(path, query), {
        method: "POST",
        body: JSON.stringify(body),
      });
    }
    case "link_to_product": {
      const url = buildMedusaUrl(productOptionsPath(productId, "/batch"), query);
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
          "Invalid action. Valid actions are: list, get, create, update, delete, list_values, get_value, update_value, delete_value, link_to_product",
      };
  }
}

const apiTool = {
  definition: {
    name: "manage_medusa_admin_product_options",
    title: "Product Options",
    description:
      "Manage Medusa product options through the Admin API (reusable options since Medusa 2.16; routes present on 2.17.2+, incl. 2.18 and 2.21.1). " +
      "list (all options, or the options of a product when product_id is given), get, create (title + values; with product_id it creates the option AND links it to that product), " +
      "update (option_id: title, values, ranks, is_exclusive, metadata), delete (option_id: deletes the option globally; with product_id it only unlinks it from that product), " +
      "list_values / get_value / update_value / delete_value (option_id + value_id), link_to_product (product_id + add/remove/update via /options/batch).",
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
          enum: [
            "list",
            "get",
            "create",
            "update",
            "delete",
            "list_values",
            "get_value",
            "update_value",
            "delete_value",
            "link_to_product",
          ],
          description: "The product option operation to perform.",
        },
        product_id: {
          type: "string",
          description:
            "Product ID. Required for link_to_product. Optional for list (options of that product), create (also link) and delete (unlink only).",
        },
        option_id: {
          type: "string",
          description: "Product option ID required for get, update, delete and value actions.",
        },
        value_id: {
          type: "string",
          description: "Product option value ID required for get_value, update_value and delete_value.",
        },
        id: {
          type: "string",
          description: "Filter list by option ID.",
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
        value: {
          type: "string",
          description: "Option value text for update_value, or filter for list_values.",
        },
        ranks: {
          type: "object",
          description: "Map of option value to rank, supported since Medusa 2.16.",
        },
        is_exclusive: {
          type: "boolean",
          description:
            "Whether the option is product-exclusive. Use false for reusable/global options. Also a list filter.",
        },
        metadata: {
          type: "object",
          description: "Metadata for create/update and update_value actions.",
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
          description: "Option value updates for link_to_product: [{ product_option_id, add?, remove? }].",
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
        order: {
          type: "string",
          description: "Sort order for list, e.g. title or -created_at.",
        },
        query: {
          type: "object",
          description: "Additional Admin API query parameters.",
        },
      },
      required: ["action"],
    },
  },
  function: withMedusaErrorHints(executeFunction),
};

export { apiTool };
