const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { getAgent, getAllAgents, getAgentSummaries } = require('../../agents');

describe('agents', () => {
  describe('getAllAgents', () => {
    it('returns array of agents', () => {
      const agents = getAllAgents();
      assert.ok(Array.isArray(agents));
    });

    it('loads all 15 agent files', () => {
      assert.equal(getAllAgents().length, 15);
    });

    it('each agent has required fields', () => {
      for (const agent of getAllAgents()) {
        assert.ok(agent.id, `agent missing id`);
        assert.ok(agent.name, `${agent.id} missing name`);
        assert.ok(agent.icon, `${agent.id} missing icon`);
        assert.ok(agent.description, `${agent.id} missing description`);
        assert.ok(agent.systemPrompt, `${agent.id} missing systemPrompt`);
      }
    });
  });

  describe('getAgent', () => {
    it('returns mindmap agent', () => {
      const agent = getAgent('mindmap');
      assert.ok(agent);
      assert.equal(agent.id, 'mindmap');
      assert.ok(agent.systemPrompt.length > 0);
    });

    it('returns undefined for nonexistent agent', () => {
      assert.equal(getAgent('nonexistent_agent_xyz'), undefined);
    });
  });

  describe('getAgentSummaries', () => {
    it('returns summaries without systemPrompt', () => {
      const summaries = getAgentSummaries();
      assert.equal(summaries.length, 15);
      for (const s of summaries) {
        assert.ok(s.id);
        assert.ok(s.name);
        assert.ok(s.icon);
        assert.ok(s.description);
        assert.equal(s.systemPrompt, undefined, `${s.id} should not include systemPrompt`);
      }
    });
  });
});
