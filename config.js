// Centralized configuration — all hardcoded values in one place
module.exports = {
  // Server
  port: process.env.PORT || 5000,
  host: '0.0.0.0',

  // Socket.IO
  maxHttpBufferSize: 15 * 1024 * 1024, // 15MB for file uploads

  // Claude API
  claude: {
    model: 'claude-sonnet-4-20250514',
    chatMaxTokens: 1500,
    generationMaxTokens: 3000,
    promptMaxTokens: 500,
  },

  // Messages
  maxMessages: 200,
  messageTrimKeepFirst: 5,
  messageTrimKeepLast: 30,
  messageTrimThreshold: 50,

  // Files
  maxFiles: 5,
  maxFileSizeBytes: 10 * 1024 * 1024, // 10MB
  maxFileSizeBase64: 10 * 1024 * 1024 * 1.37, // ~13.7MB base64

  // Canvas grid layout
  grid: {
    cols: 2,
    cardWidth: 540,
    cardHeight: 360,
    gap: 40,
    offsetX: 40,
    offsetY: 40,
  },

  // Room management
  roomCleanupDelayMs: 5 * 60 * 1000, // 5 minutes

  // User colors
  userColors: ['#6c5ce7', '#00cec9', '#fdcb6e', '#fd79a8', '#74b9ff', '#ff6b6b', '#a29bfe', '#55efc4'],
};
