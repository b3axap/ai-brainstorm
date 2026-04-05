try { require('dotenv/config'); } catch(e) { /* dotenv optional, Replit uses Secrets */ }

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const config = require('../config');
const { getAgentSummaries } = require('../agents');
const { initSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: config.maxHttpBufferSize });

app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Agent list for client
app.get('/api/agents', (req, res) => res.json(getAgentSummaries()));

// Initialize Socket.IO event handlers
initSocket(io);

// Start
server.listen(config.port, config.host, () => {
  console.log(`AI Brainstorm server running on port ${config.port}`);
});
