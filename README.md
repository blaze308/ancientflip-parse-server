# 🚀 AncientFlip Parse Server

A modern, production-ready Parse Server implementation for the AncientFlip application.

![Parse Server](https://img.shields.io/badge/Parse_Server-8.1.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-v20-green)
![Express](https://img.shields.io/badge/Express-4.18-lightgrey)

## 📋 Overview

This repo contains a customized Parse Server setup optimized for the AncientFlip application. Parse Server provides a scalable backend with user management, data storage, and cloud functions.

## ✨ Features

- 🔐 User authentication and management
- 💾 MongoDB data storage
- ☁️ Cloud code functions
- 🌐 REST API endpoint
- 📱 Mobile SDK compatibility
- 🔄 Live queries (optional)

## 🛠️ Local Development

### Prerequisites

- Node.js v20+
- npm or yarn
- Git

### Setup

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/ancientflip-parse-server.git
cd ancientflip-parse-server
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment variables**

Create a `.env` file in the root directory:

```
PARSE_SERVER_APPLICATION_ID=
PARSE_SERVER_MASTER_KEY=
PARSE_SERVER_DATABASE_URI=
PARSE_SERVER_URL=
PARSE_SERVER_CLOUD=./cloud/main.js
PORT=1337
```

4. **Start the server**

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

5. **Access the server**

Your Parse Server is now running at [http://localhost:1337/parse](http://localhost:1337/parse)

Parse Dashboard is available at [http://localhost:1337/dashboard](http://localhost:1337/dashboard)

- Default username: `admin`
- Default password: `password`

## 🚢 Deployment

### Deploy to Render

1. **Create a new Web Service**

   - Sign up at [render.com](https://render.com)
   - Connect your GitHub repository
   - Select Node.js environment

2. **Configure build settings**

   - Build Command: `npm install`
   - Start Command: `npm start`

3. **Set environment variables**

   ```
   PARSE_SERVER_APPLICATION_ID=YOUR_APP_ID
   PARSE_SERVER_MASTER_KEY=YOUR_MASTER_KEY
   PARSE_SERVER_DATABASE_URI=YOUR_MONGODB_CONNECTION_STRING
   PARSE_SERVER_URL=https://your-render-url.com/parse
   PARSE_SERVER_CLOUD=./cloud/main.js
   APP_NAME=YourAppName
   DASHBOARD_USER=your_secure_username
   DASHBOARD_PASSWORD=your_secure_password
   NODE_ENV=production
   PORT=10000
   ```

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (usually takes a few minutes)

Your Parse Server will be available at: `https://your-render-url.com/parse`

## 📡 API Usage

### REST API

To interact with your Parse Server, use these headers:

```
X-Parse-Application-Id: YOUR_APP_ID
Content-Type: application/json
```

**Example: Query users**

```bash
curl -X GET \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  https://your-server-url.com/parse/classes/_User
```

**Example: Create object**

```bash
curl -X POST \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{"score":1337,"playerName":"John","cheatMode":false}' \
  https://your-server-url.com/parse/classes/GameScore
```

## 📚 Cloud Functions

Call cloud functions from your client:

```bash
curl -X POST \
  -H "X-Parse-Application-Id: YOUR_APP_ID" \
  -H "Content-Type: application/json" \
  -d '{}' \
  https://your-server-url.com/parse/functions/hello
```

## 🔧 Advanced Configuration

For advanced configuration options, see the [Parse Server documentation](https://docs.parseplatform.org/parse-server/guide/).

## 📄 License

MIT

---

Built with ❤️ by the AncientFlip team
