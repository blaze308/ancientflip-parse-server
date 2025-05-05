require('dotenv').config();
const express = require('express');
const ParseServer = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');

async function startServer() {
  const app = express();

  // Parse Server configuration
  const serverConfig = {
    databaseURI: process.env.PARSE_SERVER_DATABASE_URI,
    cloud: process.env.PARSE_SERVER_CLOUD || './cloud/main.js',
    appId: process.env.PARSE_SERVER_APPLICATION_ID,
    masterKey: process.env.PARSE_SERVER_MASTER_KEY,
    serverURL: process.env.PARSE_SERVER_URL,
  };

  const server = new ParseServer(serverConfig);

  // Parse Dashboard configuration
  const dashboardConfig = {
    apps: [
      {
        serverURL: serverConfig.serverURL,
        appId: serverConfig.appId,
        masterKey: serverConfig.masterKey,
        appName: process.env.APP_NAME || 'AncientFlip',
      },
    ],
    users: [
      {
        user: process.env.DASHBOARD_USER || 'admin',
        pass: process.env.DASHBOARD_PASSWORD || 'password',
      },
    ],
    useEncryptedPasswords: true,
  };

  // For development environments - REMOVE IN PRODUCTION
  const dashboardOptions = {
    allowInsecureHTTP: process.env.NODE_ENV !== 'production',
  };

  const dashboard = new ParseDashboard(dashboardConfig, dashboardOptions);

  // Start Parse Server
  await server.start();

  // Mount Parse Server on /parse path
  app.use('/parse', server.app);

  // Mount Parse Dashboard on /dashboard path
  app.use('/dashboard', dashboard);

  // Start the Express app
  const httpServer = require('http').createServer(app);
  httpServer.listen(process.env.PORT || 1337, function () {
    // eslint-disable-next-line no-console
    console.log(
      `Server running on port ${
        process.env.PORT || 1337
      } with Parse Server at /parse and Dashboard at /dashboard`
    );
  });
}

startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
