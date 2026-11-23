const app = require('./app');
const env = require('./config/env');
const { connectAllDatabases, disconnectAllDatabases } = require('./config/database');

let server;
let secondaryServer;

async function startServer() {
  try {
    console.log('================================================================');
    console.log(' Pharmaceutical Management System — Unified Fullstack Server');
    console.log('================================================================');

    // 1. Initialize Multi-Database Connections (Warehouse & Pharmacy)
    await connectAllDatabases();

    // 2. Start Primary HTTP Server (serves both Frontend UI & Backend APIs)
    server = app.listen(env.PORT, () => {
      console.log(`[Server] Express server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
      console.log(`[Server] Web App & APIs: http://localhost:${env.PORT}/`);
      console.log(`[Server] Health check:   http://localhost:${env.PORT}/api/health`);
      console.log('================================================================');
    });

    // 3. Also listen on port 3000 if PORT is 5000 (allows seamless access on either port)
    if (env.PORT !== 3000) {
      try {
        secondaryServer = app.listen(3000, () => {
          console.log(`[Server] Dual-Port Listener: ALSO active on http://localhost:3000/`);
        });
        secondaryServer.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[Server] Port 3000 is occupied by another process; primary server on ${env.PORT} active.`);
          } else {
            console.warn(`[Server] Secondary port 3000 warning:`, err.message);
          }
        });
      } catch (e) {
        // Ignore secondary listener failure
      }
    }

  } catch (error) {
    console.error('FATAL: Server initialization failed:', error.message);
    process.exit(1);
  }
}

// Graceful process termination
const handleExit = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  const closePromises = [];

  if (server) {
    closePromises.push(new Promise((resolve) => server.close(resolve)));
  }
  if (secondaryServer) {
    closePromises.push(new Promise((resolve) => secondaryServer.close(resolve)));
  }

  await Promise.all(closePromises);
  console.log('[Server] HTTP servers closed.');
  await disconnectAllDatabases();
  process.exit(0);
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
