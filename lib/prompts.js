export const MCP_PROMPTS = [
  {
    name: "medusa_upgrade_project",
    title: "Upgrade a Medusa Project",
    description:
      "Plan and execute a Medusa version upgrade with dependency, migration, and MCP compatibility checks.",
    text:
      "Audit this Medusa project upgrade. Check package versions, API changes, migrations, admin customizations, MCP tool coverage, auth, and validation commands. Return a concise risk-ranked plan before changing code.",
  },
  {
    name: "medusa_global_product_options",
    title: "Manage Product Options",
    description:
      "Work with Medusa 2.16+ reusable product options and product option linking.",
    text:
      "Use the product option tools to inspect reusable options, link them to products, and create or update product options. Prefer read actions first. For writes, state the product_id, option_id, title, values, and is_exclusive behavior before executing.",
  },
  {
    name: "medusa_integrate_payment_provider",
    title: "Integrate Payment Provider",
    description:
      "Guide implementation of a Medusa payment provider integration.",
    text:
      "Help integrate a Medusa payment provider. Inspect existing payment modules, region configuration, environment variables, webhook needs, and test strategy. Produce implementation steps and verification commands.",
  },
  {
    name: "medusa_integrate_fulfillment_provider",
    title: "Integrate Fulfillment Provider",
    description:
      "Guide implementation of a Medusa fulfillment provider integration.",
    text:
      "Help integrate a Medusa fulfillment provider. Inspect fulfillment modules, stock locations, shipping options, environment variables, and operational constraints. Produce implementation steps and verification commands.",
  },
];

export function getMcpPrompt(name) {
  return MCP_PROMPTS.find((prompt) => prompt.name === name);
}
