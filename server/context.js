const config = require('../config');

// Build Claude context from per-user chat history
function buildContext(room, socketId) {
  const userNames = room.users.map(u => u.name).join(', ') || 'none';
  const artifactList = room.artifacts.map(a =>
    `- [${a.type}] "${a.title}" (id:${a.id}) by ${a.author}`
  ).join('\n') || 'none yet';

  const systemBase = `You are an AI brainstorming partner in a collaborative room.
Room ID: ${room.id}
Active users: ${userNames}
Existing artifacts in this session:
${artifactList}

Your job is to help users develop their ideas, make connections between different perspectives, and suggest useful visualizations.`;

  // Use per-user chat history, with multimodal support for files
  const userChat = room.userChats[socketId];
  let msgs = (userChat ? userChat.messages : []).map(m => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';

    // Build multimodal content if files are attached
    if (m.files && m.files.length > 0 && role === 'user') {
      const contentBlocks = [];
      m.files.forEach(f => {
        if (f.isImage && f.data) {
          contentBlocks.push({
            type: 'image',
            source: { type: 'base64', media_type: f.type, data: f.data }
          });
        } else if (f.data) {
          try {
            const decoded = Buffer.from(f.data, 'base64').toString('utf-8');
            contentBlocks.push({ type: 'text', text: `[File: ${f.name}]\n${decoded}` });
          } catch { /* skip unreadable files */ }
        }
      });
      if (m.content) contentBlocks.push({ type: 'text', text: m.content });
      return { role, content: contentBlocks.length > 0 ? contentBlocks : m.content };
    }

    return { role, content: m.content };
  });

  // Trim if too long
  if (msgs.length > config.messageTrimThreshold) {
    msgs = [
      ...msgs.slice(0, config.messageTrimKeepFirst),
      { role: 'user', content: '[... earlier messages trimmed ...]' },
      ...msgs.slice(-config.messageTrimKeepLast)
    ];
  }

  return { systemBase, messages: msgs };
}

module.exports = { buildContext };
