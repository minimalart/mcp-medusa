const { defineConfig } = require('@medusajs/framework/utils');

const databaseUrl = new URL(process.env.CONTRACT_DATABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(databaseUrl.hostname) || databaseUrl.pathname !== '/mcp_contracts') {
  throw new Error('The Medusa contract fixture requires a local mcp_contracts database.');
}

module.exports = defineConfig({
  admin: { disable: true },
  projectConfig: {
    databaseUrl: databaseUrl.href,
    http: {
      jwtSecret: 'mcp-contract-test-jwt',
      cookieSecret: 'mcp-contract-test-cookie',
    },
  },
});
