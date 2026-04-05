const config = require('../../config');
const { getAgent } = require('../../agents');
const { generateId, extractResponseText, calcArtifactPosition } = require('../utils');
const { buildContext } = require('../context');
const claude = require('./client');

async function handleArtifactGeneration(room, type, userName, socket, io, referenceIds, customPrompt) {
  const agent = getAgent(type);
  if (!agent) {
    socket.emit('generation-error', { roomId: room.id, message: `Unknown agent type: ${type}` });
    return;
  }

  io.to(room.id).emit('artifact-generating', { roomId: room.id, type, status: 'working' });

  // External API agents (placeholder)
  if (agent.externalAPI) {
    const { systemBase, messages } = buildContext(room, socket.id);
    try {
      const response = await claude.getClient().messages.create({
        model: config.claude.model,
        max_tokens: config.claude.promptMaxTokens,
        system: `${systemBase}\n\n${agent.systemPrompt}`,
        messages
      });

      const text = extractResponseText(response);
      if (!text) throw new Error('Empty response from Claude');
      let data;
      try { data = JSON.parse(text); } catch {
        data = { prompt: text, style: 'illustration' };
      }

      data.imageUrl = null;
      data.placeholder = true;

      const artifact = {
        id: generateId(),
        type: agent.id,
        title: data.prompt ? data.prompt.substring(0, 40) + '...' : 'Generated Image',
        data,
        author: userName,
        renderer: agent.renderer,
        icon: agent.icon,
        timestamp: Date.now(),
        position: calcArtifactPosition(room.artifacts.length)
      };

      room.artifacts.push(artifact);
      io.to(room.id).emit('artifact-created', { roomId: room.id, artifact });
    } catch (error) {
      socket.emit('generation-error', { roomId: room.id, message: error.message });
    }
    return;
  }

  // Claude-based agents
  const { systemBase, messages } = buildContext(room, socket.id);
  let fullSystem = `${systemBase}\n\n${agent.systemPrompt}`;

  // Inject reference artifact data
  if (referenceIds && referenceIds.length > 0) {
    const refs = referenceIds
      .map(id => room.artifacts.find(a => a.id === id))
      .filter(Boolean)
      .map(a => `[${a.type}] "${a.title}":\n${JSON.stringify(a.data, null, 2)}`)
      .join('\n\n');
    if (refs) fullSystem += `\n\nREFERENCE ARTIFACTS (use this data as context):\n${refs}`;
  }
  if (customPrompt) fullSystem += `\n\nADDITIONAL USER INSTRUCTIONS: ${customPrompt}`;

  try {
    const response = await claude.getClient().messages.create({
      model: config.claude.model,
      max_tokens: config.claude.generationMaxTokens,
      system: fullSystem,
      messages
    });

    const text = extractResponseText(response);
    if (!text) throw new Error('Empty response from Claude');
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch {
          // Retry with stricter prompt
          console.log(`Retrying ${type} generation (invalid JSON)...`);
          const retry = await claude.getClient().messages.create({
            model: config.claude.model,
            max_tokens: config.claude.generationMaxTokens,
            system: fullSystem + '\n\nCRITICAL: Output ONLY valid JSON. No markdown, no explanation, no code fences. Just the JSON object.',
            messages
          });
          const retryText = retry.content[0].text;
          try {
            data = JSON.parse(retryText);
          } catch {
            const retryMatch = retryText.match(/\{[\s\S]*\}/);
            data = retryMatch ? JSON.parse(retryMatch[0]) : { error: 'Failed to parse', raw: retryText };
          }
        }
      } else {
        data = { error: 'No JSON in response', raw: text };
      }
    }

    const artifact = {
      id: generateId(),
      type: agent.id,
      title: data.title || data.center || agent.name + ' visualization',
      data,
      author: userName,
      renderer: agent.renderer,
      icon: agent.icon,
      timestamp: Date.now(),
      position: calcArtifactPosition(room.artifacts.length)
    };

    room.artifacts.push(artifact);
    io.to(room.id).emit('artifact-created', { roomId: room.id, artifact });

  } catch (error) {
    console.error(`Agent ${type} error:`, error.message);
    socket.emit('generation-error', { roomId: room.id, message: error.message });
  }
}

module.exports = { handleArtifactGeneration };
