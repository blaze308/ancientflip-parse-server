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
    websocketTimeout: websocketTimeout,
    websocketServerURL: websocketURL,
    appName: 'AncientFlip',
    // Email configuration for password reset
    emailAdapter: {
      module: '@parse/simple-mailgun-adapter',
      options: {
        // Get these from environment variables or use defaults for testing
        fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@ancientflip.com',
        domain: process.env.MAILGUN_DOMAIN || 'your-mailgun-domain.com',
        apiKey: process.env.MAILGUN_API_KEY || 'your-mailgun-api-key',
        // Email templates
        templates: {
          passwordResetEmail: {
            subject: 'Reset your password for AncientFlip',
            pathPlainText: __dirname + '/email-templates/password-reset-email.txt',
            pathHtml: __dirname + '/email-templates/password-reset-email.html',
            callback: user => {
              // You can return additional variables to use in the email template
              return {
                username: user.get('username'),
              };
            },
          },
          verificationEmail: {
            subject: 'Please verify your email for AncientFlip',
            pathPlainText: __dirname + '/email-templates/verification-email.txt',
            pathHtml: __dirname + '/email-templates/verification-email.html',
          },
        },
      },
    },
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
  };

  const server = new ParseServer(serverConfig);

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
