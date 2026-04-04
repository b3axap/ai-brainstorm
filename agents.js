const fs = require('fs');
const path = require('path');

const agentsDir = path.join(__dirname, 'agents');

// Load all agent JSON files from agents/ directory
const agents = fs.readdirSync(agentsDir)
  .filter(f => f.endsWith('.json') && !f.startsWith('_'))
  .map(f => {
    try {
      return JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf8'));
    } catch (e) {
      console.error(`Failed to load agent ${f}:`, e.message);
      return null;
    }
  })
  .filter(Boolean);

console.log(`Loaded ${agents.length} agents: ${agents.map(a => a.id).join(', ')}`);

function getAgent(id) {
  return agents.find(a => a.id === id);
}

function getAllAgents() {
  return agents;
}

// Get agent list for Claude to suggest (id, name, icon, description)
function getAgentSummaries() {
  return agents.map(a => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    description: a.description
  }));
}

module.exports = { agents, getAgent, getAllAgents, getAgentSummaries };
