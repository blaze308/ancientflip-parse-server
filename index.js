require('dotenv').config();
const express = require('express');
const ParseServer = require('parse-server').ParseServer;
const ParseDashboard = require('parse-dashboard');

async function startServer() {
  const app = express();

  // Define server URLs
  const serverURL = 'https://ancientflip-parse-server.onrender.com/parse';
  const websocketURL = 'wss://ancientflip-parse-server.onrender.com';
  const websocketTimeout = parseInt(process.env.WEBSOCKET_TIMEOUT) || 60000;

  // Parse Server configuration
  const serverConfig = {
    databaseURI: process.env.PARSE_SERVER_DATABASE_URI,
    cloud: process.env.PARSE_SERVER_CLOUD || './cloud/main.js',
    appId: process.env.PARSE_SERVER_APPLICATION_ID,
    masterKey: process.env.PARSE_SERVER_MASTER_KEY,
    serverURL: serverURL,
    publicServerURL: 'https://ancientflip-parse-server.onrender.com/parse',
    appName: 'AncientFlip',
    // Email configuration removed - not using Mailgun anymore
    liveQuery: {
      classNames: [
        'LiveStreamingModel',
        'UserModel',
        'AudioChatUsersModel',
        'LiveViewersModel',
        'GiftsSenderModel',
        'LiveMessagesModel',
        'MessageModel',
        'MessageListModel',
        'GiftsModel',
        'GiftsSenderGlobalModel',
        'LeadersModel',
        'StoriesModel',
        'StoriesAuthorsModel',
        'PostsModel',
        'ObtainedItemsModel',
      ],
    },
    fileUpload: {
      enableForPublic: true,
      enableForAuthenticatedUser: true,
      enableForAnonymousUser: true,
    },
    // Security settings
    enableInsecureAuthAdapters: false,
    // Parse object encoding
    encodeParseObjectInCloudFunction: true,
    // ACL settings - Public read and write for everything
    enforcePrivateUsers: false,

    // REMOVED DEPRECATED CONFIGURATIONS:
    // - defaultACL (deprecated - handle ACLs programmatically)
    // - defaultACLOnlyAuthenticatedUser (deprecated)
    // - classLevelPermissions (deprecated - use dashboard or programmatic approach)

    // If you need public access, handle it through:
    // 1. Cloud functions
    // 2. Parse Dashboard class-level permissions
    // 3. Programmatic ACL setting in your app code
  };

  const server = new ParseServer(serverConfig);

  // Add global CORS middleware to Express
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'X-Parse-Application-Id, X-Parse-REST-API-Key, X-Parse-Javascript-Key, X-Parse-Client-Key, X-Parse-Master-Key, X-Parse-Session-Token, Content-Type, X-Requested-With'
    );

    // Intercept OPTIONS method
    if ('OPTIONS' === req.method) {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Parse Dashboard configuration
  const dashboardConfig = {
    apps: [
      {
        serverURL: serverURL,
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
    useEncryptedPasswords: false,
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

  // Initialize LiveQuery server with the same configuration
  ParseServer.createLiveQueryServer(httpServer, {
    appId: serverConfig.appId,
    masterKey: serverConfig.masterKey,
    serverURL: serverURL,
    websocketTimeout: websocketTimeout,
    websocketServerURL: websocketURL,
  });

  const port = process.env.PORT || 1337;
  httpServer.listen(port, function () {
    console.log(
      `Server running on port ${port} with Parse Server at /parse and Dashboard at /dashboard`
    );
    console.log(`LiveQuery WebSocket server available at ${websocketURL}`);
  });
}

startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
