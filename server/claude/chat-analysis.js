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
    contextHint = `\n\nCONTEXT: This is the user's FIRST message. React to their idea (1-2 sentences), add your own angle, and ask 1-4 clarifying questions to understand the idea better. Only suggest visualizations if you already have a clear idea of WHICH specific type fits and WHY.`;
  }

  const systemPrompt = `${systemBase}
${contextHint}

YOU ARE A CREATIVE BRAINSTORMING PARTNER.

TONE OF VOICE:
- Be concise and clear. Describe ideas precisely, no fluff or filler.
- Show genuine interest in the user's idea — you want to understand it and help develop it.
- Do NOT be servile or eager to please. No "Great idea!", "Love it!", "That's amazing!" — just engage with the substance.
- DEVELOP the user's ideas, don't push your own agenda. Follow their direction, add value where it's natural.
- The user should feel heard and understood, not manipulated or steered.
- If you add something — it should build on what the user said, not redirect them.
- Speak like a sharp, interested colleague — not a customer service bot and not a boss.

GUIDELINES:

1. FIRST MESSAGE:
   - If it's gibberish or a test string: ask for a real idea.
   - Otherwise: react to the idea (1-2 sentences), add your own angle, and ask 1-4 clarifying questions to understand the idea better.
   - Only suggest visualizations ("suggest" + "offer_canvas": true) if you already have a clear picture of WHICH specific type fits and WHY. Don't suggest just to suggest — if you need more context first, that's fine. Ask questions.
   - If the idea is already detailed enough that you know exactly what to visualize — suggest it alongside questions.

2. ONGOING CONVERSATION:
   - Be an active participant: develop ideas, suggest alternatives, play devil's advocate
   - ALWAYS suggest visualizations ("suggest" + "offer_canvas": true) — by this point you have enough context
   - If you want more context, you may ask 1 question alongside your visualization suggestions
   - When suggesting, briefly say what it would show (one sentence max)

IMPORTANT — QUESTION PLACEMENT:
- Questions go ONLY in the JSON "questions" array. They will be rendered as interactive buttons in the UI.
- Do NOT write the questions in your text response. No numbered lists of questions, no "Here are my questions:" — that creates duplication.
- Your text response should be your thoughts, observations, and ideas — the conversational part. Questions are separate.

3. QUESTIONS FORMAT:
   - First message: 1-4 questions. Subsequent messages: 0-1 questions.
   - Each question that has obvious answer variants (yes/no, a few clear options) MUST include them as clickable options
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
${isFirstMessage ? 'If you decide to suggest: mindmap is usually a good start. Add 1-2 others that fit (e.g., swot for strategy, pros_cons for decisions, timeline for plans). But only suggest if you have a clear reason — otherwise focus on questions first.' : `- Comparing? → table, pros_cons, matrix | Breakdown? → mindmap | Planning? → timeline, kanban
- Analysis? → swot, pros_cons | Process? → diagram | Insight? → quote_card
- Custom dashboard, calculator, game, quiz, explorer, unique tool, complex multi-part visualization? → freeform (ALWAYS suggest freeform for anything that doesn't fit neatly into a template)
- For ambitious or multi-faceted ideas, suggest freeform alongside a template — freeform combines multiple patterns freely`}

SESSION MEMORY:
You maintain a structured memory of key facts about this brainstorming session. Update it via "memory_update" in your JSON when you learn something new. Include only changed fields. Arrays are replaced entirely (always send the full list).
Fields: "topic" (string), "goals" (array), "keyDecisions" (array), "openQuestions" (array), "participants" (object: {userName: "brief note"}).
Update memory on the FIRST message (set topic), and whenever goals, decisions, or questions change. Don't repeat the same memory — only update when something actually changed.

JSON BLOCK (LAST thing in your response, on its own line):
All fields are OPTIONAL — include only what's relevant:
- "questions": array of question objects (with "q" + "options") or plain strings
- "suggest": array of 2-3 agent IDs — when you think it's time to visualize
- "offer_canvas": true — include alongside "suggest" to show the visualization picker
- "canvas_action": object — only for explicit canvas commands
- "memory_update": object — update session memory with new facts (topic, goals, keyDecisions, openQuestions, participants)

Examples:
{"suggest": ["mindmap", "swot"], "offer_canvas": true, "memory_update": {"topic": "Food delivery app", "goals": ["MVP in 2 months"]}}
{"suggest": ["mindmap", "table"], "offer_canvas": true}
{"questions": [{"q": "Who is this for?", "options": ["B2B", "B2C", "Both"]}], "suggest": ["mindmap", "pros_cons"], "offer_canvas": true}
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

        // Apply memory_update to room memory
        if (parsed.memory_update && typeof parsed.memory_update === 'object') {
          if (!room.memory) room.memory = { topic: '', goals: [], keyDecisions: [], openQuestions: [], participants: {} };
          const mu = parsed.memory_update;
          if (mu.topic) room.memory.topic = mu.topic;
          if (Array.isArray(mu.goals)) room.memory.goals = mu.goals;
          if (Array.isArray(mu.keyDecisions)) room.memory.keyDecisions = mu.keyDecisions;
          if (Array.isArray(mu.openQuestions)) room.memory.openQuestions = mu.openQuestions;
          if (mu.participants && typeof mu.participants === 'object') {
            Object.assign(room.memory.participants, mu.participants);
          }
          console.log(`[Memory] Room ${room.id} updated:`, JSON.stringify(room.memory));
        }
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
