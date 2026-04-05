# Socket.IO Event Contract

**Server handlers:** `server/handlers/` (room.js, chat.js, artifact.js, session.js)
**Client handlers:** `public/modules/socket-handlers.js`
**Event router:** `server/socket.js`

## Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-room` | `{ roomId?, userName }` | Create or join room. Error if `roomId` provided but not found. |
| `send-message` | `{ roomId, content, isNewIdea?, files? }` | Chat message → Claude. `files`: `[{name, type, data (base64), isImage}]` max 5, 10MB each. |
| `generate-artifact` | `{ roomId, type, referenceIds?, customPrompt? }` | Generate visualization. `referenceIds` = other artifacts to use as context. |
| `move-artifact` | `{ roomId, artifactId, position }` | Drag artifact on canvas. |
| `artifact-action` | `{ roomId, artifactId, action, payload? }` | `action`: `'expand'` / `'transform'` / `'ask'`. `payload`: target type or question text. |
| `artifact-data-patch` | `{ roomId, artifactId, patch: {path, value} }` | Inline edit: scalar value at dot-path. |
| `artifact-array-op` | `{ roomId, artifactId, op: {type, path, value?, toPath?} }` | Array ops: `insert` / `remove` / `move`. See [interactivity.md](interactivity.md). |
| `execute-canvas-action` | `{ roomId, canvasAction }` | Execute Claude's suggested canvas action. |
| `delete-artifact` | `{ roomId, artifactId }` | Delete artifact from room. Broadcasts `artifact-deleted` to all users. |
| `import-session` | `{ userName, artifacts, messages? }` | Create new room with imported artifacts/messages. Response: `room-joined`. |
| `import-to-room` | `{ roomId, artifacts }` | Add imported artifacts to existing room. Response: `artifact-created` per artifact + `import-complete`. |

## Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-joined` | `{ room, user }` | Full room state (personal chat + shared artifacts). |
| `join-error` | `{ message }` | Room code not found. |
| `user-joined` | `{ user }` | Someone joined the room. |
| `user-left` | `{ socketId }` | Someone left. |
| `new-message` | `{ message }` | Chat message (to sender only). |
| `sidebar-message` | `{ message }` | Chat message (to others, sidebar only). |
| `claude-chunk` | `{ roomId, chunk }` | Streaming token. |
| `claude-done` | `{ fullMessage, suggestedTypes?, clarifyQuestions?, offerCanvas?, canvasAction? }` | Final response. All fields optional. |
| `artifact-generating` | `{ roomId, type, status }` | Generation started. |
| `artifact-created` | `{ roomId, artifact }` | New artifact for canvas. |
| `artifact-updated` | `{ roomId, artifactId, data, title }` | Re-render artifact (expand/transform/ask/inline edit). |
| `artifact-moved` | `{ artifactId, position }` | Position sync from other user. |
| `artifact-deleted` | `{ artifactId }` | Artifact removed — delete card from canvas. |
| `generation-error` | `{ roomId, message }` | Error (sent to requesting user only). |
| `import-error` | `{ message }` | Session import failed (invalid file, room not found). |
| `import-complete` | `{ count }` | Artifacts successfully imported into existing room. |

## In-Memory Data Model

**Source:** `server/data/memory.js`

```js
rooms[roomId] = {
  id: string,             // 6-char alphanumeric
  messages: [],           // shared activity log (capped at 200)
  artifacts: [{
    id, type, title, data, author, renderer, icon, timestamp,
    position: { x, y }
  }],
  users: [{ socketId, name, color }],
  userChats: {            // per-user private chat
    [socketId]: {
      messages: [],       // capped at 200
      phase: { msgCount }
    }
  },
  _cleanupTimer: null     // 5-min empty room cleanup
}
```
