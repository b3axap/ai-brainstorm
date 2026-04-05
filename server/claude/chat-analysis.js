const config = require('../../config');
const { getAgentSummaries } = require('../../agents');
const { generateId, extractLastJsonBlock } = require('../utils');
const { buildContext } = require('../context');
const claude = require('./client');

async function handleChatAnalysis(room, socket, isNewIdea) {
  const { systemBase, messages } = buildContext(room, socket.id);
  const agentList = getAgentSummaries()
    .map(a => `${a.id}: ${a.icon} ${a.name} — ${a.description}`)
    .join('\n');

  const userChat = room.userChats[socket.id];
  const userMsgCount = userChat ? userChat.phase.msgCount : 0;
  const isFirstMessage = userMsgCount <= 1;

  let contextHint = '';
  if (isNewIdea) {
    contextHint = `\n\nCONTEXT: The user is introducing a NEW, ADDITIONAL idea (via the ➕ button). If it's a real idea: analyze it, find connections with the existing brainstorm, suggest integration, and include "suggest" + "offer_canvas": true. If it's vague or unclear, ask what the idea actually is before offering anything.`;
  } else if (isFirstMessage) {
    contextHint = `\n\nCONTEXT: This is the user's FIRST message. Show you get the idea, share your own angle on it, and ask what you genuinely need to know.`;
  }

  const systemPrompt = `${systemBase}
${contextHint}

YOU ARE A CREATIVE BRAINSTORMING PARTNER.

Behave like a smart, engaged colleague — not a questionnaire bot. Be natural and adaptive.

CRITICAL RULE — VISUALIZATION READINESS:
Before you EVER include "suggest" or "offer_canvas" in the JSON, ask yourself:
"Can I describe in one sentence WHAT I would visualize and WHY it would be useful?"
If the answer is no — you don't have enough context. Keep talking, ask questions, dig deeper.

NEVER suggest visualizations when:
- The user's message is unclear, gibberish, or a test input (e.g. "aaa", "test", "BBB")
- You don't understand the actual idea yet
- The conversation is still at the "what are we even talking about" stage
- You're just being polite or trying to seem helpful

In these cases, be honest: "I'd love to help brainstorm, but I need to understand your idea first. What are you working on?"

GUIDELINES (not rigid rules):

1. FIRST MESSAGE:
   - If the message is vague, off-topic, or nonsense — say so directly and ask for a real idea. Don't pretend you understood something.
   - If it's a real idea: show you get it (1-2 sentences, casual), add your own angle, and put questions in the JSON block.
   - If it's already very detailed: you can skip questions and suggest visualizations right away.

2. ONGOING CONVERSATION:
   - Be an active participant: develop ideas, suggest alternatives, play devil's advocate when useful
   - Ask questions ONLY when you actually need clarification (0-2 at a time)

IMPORTANT — QUESTION PLACEMENT:
- Questions go ONLY in the JSON "questions" array. They will be rendered as interactive buttons in the UI.
- Do NOT write the questions in your text response. No numbered lists of questions, no "Here are my questions:" — that creates duplication.
- Your text response should be your thoughts, observations, and ideas — the conversational part. Questions are separate.
   - Suggest visualizations when you can clearly articulate WHAT would be visualized — not just because some messages have passed
   - When suggesting a visualization, say in one sentence WHAT it would show and WHY it helps

3. QUESTIONS FORMAT:
   - If a question has obvious answer variants (yes/no, a few clear options), include them as clickable options
   - Format: {"q": "question text", "options": ["Option A", "Option B", "Option C"]}
   - If the question is open-ended with no obvious options, just include the question as a string: "What's your main concern?"
   - The user can ALWAYS type their own answer regardless, options are just shortcuts
   - Don't force options where they don't make sense

${room.artifacts.length > 0 ? `4. CANVAS ACTIONS:
   When the user CLEARLY wants to create, update, or transform a visualization, include "canvas_action":
   - "make a mindmap" → canvas_action: {"intent":"create", "artifact_type":"mindmap"}
   - "update the table" → canvas_action: {"intent":"update", "target_id":"<id>", "instruction":"..."}
   - "convert to presentation" → canvas_action: {"intent":"transform", "target_id":"<id>", "artifact_type":"presentation"}
   Only when intent is UNAMBIGUOUS. Normal discussion does NOT get canvas_action.
` : ''}
AVAILABLE VISUALIZATION TYPES:
${agentList}

CHOOSING VISUALIZATIONS:
${isFirstMessage ? 'mindmap is usually a great start for a new idea.' : `- Comparing? → table, pros_cons, matrix | Breakdown? → mindmap | Planning? → timeline, kanban
- Analysis? → swot, pros_cons | Process? → diagram | Custom? → freeform | Insight? → quote_card`}

JSON BLOCK (LAST thing in your response, on its own line):
All fields are OPTIONAL — include only what's relevant:
- "questions": array of question objects (with "q" + "options") or plain strings
- "suggest": array of 2-3 agent IDs — when you think it's time to visualize
- "offer_canvas": true — include alongside "suggest" to show the visualization picker
- "canvas_action": object — only for explicit canvas commands

Examples:
{"questions": [{"q": "Who is this for?", "options": ["B2B", "B2C", "Both"]}, "What problem does it solve?"]}
{"suggest": ["mindmap", "table"], "offer_canvas": true}
{"canvas_action": {"intent": "create", "artifact_type": "mindmap"}}

Rules:
- JSON block must be the LAST line.
- Use the same language the user writes in.
- Be concise. No fluff. No filler questions.`;

  // Abort any previous in-flight stream for this socket
  const prevAbort = claude.getAbort(socket.id);
  if (prevAbort) prevAbort.abort();

  const abortController = new AbortController();
  claude.setAbort(socket.id, abortController);
  claude.lock(socket.id);

  try {
    let fullResponse = '';

    const stream = claude.getClient().messages.stream({
      model: config.claude.model,
      max_tokens: config.claude.chatMaxTokens,
      system: systemPrompt,
      messages: messages
    }, { signal: abortController.signal });

    stream.on('text', (text) => {
      if (abortController.signal.aborted) return;
      fullResponse += text;
      socket.emit('claude-chunk', { roomId: room.id, chunk: text });
    });

    await stream.finalMessage();

    // Parse JSON block at end of response
    let suggestedTypes = [];
    let clarifyQuestions = [];
    let offerCanvas = false;
    let canvasAction = null;

    const jsonBlock = extractLastJsonBlock(fullResponse);
    if (jsonBlock) {
      try {
        const parsed = JSON.parse(jsonBlock);
        suggestedTypes = parsed.suggest || [];
        clarifyQuestions = parsed.questions || [];
        offerCanvas = parsed.offer_canvas || false;
        canvasAction = parsed.canvas_action || null;
      } catch (e) { /* ignore parse error */ }
    }

    // Clean response text (remove JSON block)
    const cleanResponse = jsonBlock
      ? fullResponse.slice(0, fullResponse.lastIndexOf(jsonBlock)).trim()
      : fullResponse.trim();

    // Store in user's personal chat (with cap)
    const assistantMsg = {
      id: generateId(),
      role: 'assistant',
      content: cleanResponse,
      userName: 'Claude',
      timestamp: Date.now()
    };
    const userChat2 = room.userChats[socket.id];
    if (userChat2) {
      userChat2.messages.push(assistantMsg);
      if (userChat2.messages.length > config.maxMessages) {
        userChat2.messages.splice(0, userChat2.messages.length - config.maxMessages);
      }
    }
    room.messages.push(assistantMsg);
    if (room.messages.length > config.maxMessages) {
      room.messages.splice(0, room.messages.length - config.maxMessages);
    }

    socket.emit('claude-done', {
      roomId: room.id,
      fullMessage: cleanResponse,
      suggestedTypes,
      clarifyQuestions,
      offerCanvas,
      canvasAction
    });

  } catch (error) {
    if (error.name === 'AbortError' || abortController.signal.aborted) {
      console.log('Claude stream aborted for socket:', socket.id);
      return;
    }
    console.error('Claude chat error:', error.message);
    socket.emit('generation-error', {
      roomId: room.id,
      message: 'Failed to get Claude response: ' + error.message
    });
  } finally {
    claude.unlock(socket.id);
    claude.clearAbort(socket.id);
  }
}

module.exports = { handleChatAnalysis };
