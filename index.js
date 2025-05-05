require('dotenv').config();
const express = require('express');
const ParseServer = require('parse-server').ParseServer;

async function startServer() {
  const app = express();

  const server = new ParseServer({
    databaseURI:
      process.env.PARSE_SERVER_DATABASE_URI ||
      'mongodb+srv://admin:admin@e2e-test-db.vkml0lr.mongodb.net/ancientflip-test-db?retryWrites=true&w=majority',
    cloud: process.env.PARSE_SERVER_CLOUD || './cloud/main.js',
    appId: process.env.PARSE_SERVER_APPLICATION_ID || 'A8910qm5BYBajmEt8zONLLSgv7IhgWUI0aPTwsbV',
    masterKey: process.env.PARSE_SERVER_MASTER_KEY || 'gZOAivmFs42VSfzczvDuQ0dlCOGJP4g3KbzbK3PM',
    serverURL: process.env.PARSE_SERVER_URL || 'http://localhost:1337/parse',
  });

  // Start server
  await server.start();

  // Serve the Parse API on the /parse URL prefix
  app.use('/parse', server.app);

  app.listen(process.env.PORT || 1337, function () {
    // eslint-disable-next-line no-console
    console.log(`parse-server running on port ${process.env.PORT || 1337}.`);
  });
}

startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
