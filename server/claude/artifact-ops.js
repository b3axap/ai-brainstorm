const config = require('../../config');
const { getAgent } = require('../../agents');
const { generateId, extractResponseText } = require('../utils');
const { buildContext } = require('../context');
const claude = require('./client');

function parseJsonFromResponse(text) {
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}

const FREEFORM_DATA_INSTRUCTIONS = `The current data is a JSON object with "title" (string) and "html" (complete HTML document string).
You MUST return valid JSON: {"title": "...", "html": "<!DOCTYPE html><html>...</html>"}
The "html" field must contain the COMPLETE, WORKING HTML document with all <style> and <script> inline. Do NOT omit or truncate any part.`;

async function handleArtifactExpand(room, artifact, socket, io, signal) {
  const agent = getAgent(artifact.type);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const isFreeform = artifact.type === 'freeform';
  const dataInstructions = isFreeform ? FREEFORM_DATA_INSTRUCTIONS : 'Return the COMPLETE updated JSON (not just the additions).';
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are given an existing ${artifact.type} visualization. EXPAND it with significantly more detail, depth, and sub-items. Keep the same structure but make it richer.\n\n${dataInstructions}\n\nExisting data:\n${JSON.stringify(artifact.data, null, 2)}`;

  const response = await claude.getClient().messages.create({
    model: config.claude.model,
    max_tokens: agent.maxTokens || config.claude.generationMaxTokens,
    system,
    messages: [{ role: 'user', content: 'Expand this visualization with more detail.' }]
  }, { signal });

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
  const data = parseJsonFromResponse(text);
  if (!data) throw new Error('Failed to parse expanded data');

  artifact.data = data;
  artifact.title = data.title || data.center || artifact.title;
  io.to(room.id).emit('artifact-updated', {
    roomId: room.id, artifactId: artifact.id, data: artifact.data, title: artifact.title
  });
}

async function handleArtifactTransform(room, artifact, targetType, socket, io, signal) {
  const agent = getAgent(targetType);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are converting an existing ${artifact.type} visualization into a ${targetType}. Use all the information from the source data below to create the best possible ${targetType}.\n\nSource data:\n${JSON.stringify(artifact.data, null, 2)}`;

  const response = await claude.getClient().messages.create({
    model: config.claude.model,
    max_tokens: agent.maxTokens || config.claude.generationMaxTokens,
    system,
    messages: [{ role: 'user', content: `Convert this ${artifact.type} into a ${targetType}.` }]
  }, { signal });

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
  const data = parseJsonFromResponse(text);
  if (!data) throw new Error('Failed to parse transformed data');

  const newArtifact = {
    id: generateId(),
    type: agent.id,
    title: data.title || data.center || agent.name + ' visualization',
    data,
    author: socket.userName,
    renderer: agent.renderer,
    icon: agent.icon,
    timestamp: Date.now(),
    position: { x: (artifact.position?.x || 50) + 40, y: (artifact.position?.y || 50) + 40 }
  };

  room.artifacts.push(newArtifact);
  io.to(room.id).emit('artifact-created', { roomId: room.id, artifact: newArtifact });
}

async function handleArtifactAsk(room, artifact, question, socket, io, signal) {
  const agent = getAgent(artifact.type);
  if (!agent) return;

  const { systemBase } = buildContext(room, socket.id);
  const isFreeform = artifact.type === 'freeform';
  const dataInstructions = isFreeform ? FREEFORM_DATA_INSTRUCTIONS : 'Apply the requested changes and return the COMPLETE updated JSON.';
  const system = `${systemBase}\n\n${agent.systemPrompt}\n\nYou are modifying an existing ${artifact.type} visualization based on a user's request.\n\n${dataInstructions}\n\nCurrent data:\n${JSON.stringify(artifact.data, null, 2)}`;

  const response = await claude.getClient().messages.create({
    model: config.claude.model,
    max_tokens: agent.maxTokens || config.claude.generationMaxTokens,
    system,
    messages: [{ role: 'user', content: question }]
  }, { signal });

  const text = extractResponseText(response);
  if (!text) throw new Error('Empty response from Claude');
  const data = parseJsonFromResponse(text);
  if (!data) throw new Error('Failed to parse updated data');

  artifact.data = data;
  artifact.title = data.title || data.center || artifact.title;
  io.to(room.id).emit('artifact-updated', {
    roomId: room.id, artifactId: artifact.id, data: artifact.data, title: artifact.title
  });
}

module.exports = { handleArtifactExpand, handleArtifactTransform, handleArtifactAsk };
