// Which program runs the agent: the bundled model-agnostic vault-agent (default) or the Claude Code CLI.
'use strict';
const path = require('path');
const { spawn } = require('child_process');
const { DASH } = require('./config');

const AGENT_JS = path.join(DASH, '..', 'agent', 'vault-agent.js');
const USE_CLAUDE_CLI = (process.env.JARVIS_AGENT || '').toLowerCase() === 'claude';
function spawnAgent(args, opts) {
  // process.execPath is node — or Obsidian's Electron when launched by the plugin with ELECTRON_RUN_AS_NODE=1.
  return USE_CLAUDE_CLI ? spawn('claude', args, opts) : spawn(process.execPath, [AGENT_JS, ...args], opts);
}
const AGENT_HINT = USE_CLAUDE_CLI ? 'Install: npm install -g @anthropic-ai/claude-code' : 'Check your .env (see README → Setup).';

const PERMISSIONS = process.env.JARVIS_FULL
  ? ['--dangerously-skip-permissions']
  : ['--permission-mode', 'acceptEdits', '--allowedTools', 'WebSearch', 'WebFetch', 'TodoWrite', 'Task',
     // Locally-registered servers
     'mcp__google-calendar', 'mcp__gmail', 'mcp__obsidian',
     // claude.ai connectors — Claude Code exposes these under a sanitised name,
     // "Google Calendar" -> mcp__claude_ai_Google_Calendar. Without these listed,
     // every call sits pending a permission prompt that never arrives headlessly.
     'mcp__claude_ai_Google_Calendar', 'mcp__claude_ai_Gmail', 'mcp__claude_ai_Google_Drive',
     'mcp__claude_ai_Notion', 'mcp__claude_ai_Canva'];
     // Gmail stays read + draft: Google's Gmail MCP exposes no send tool at all.

const ASK_ARGS = ['--model', process.env.JARVIS_ASK_MODEL || 'sonnet']; // sonnet: understands multi-step vault ops; set JARVIS_ASK_MODEL=haiku for cheap mode

module.exports = { spawnAgent, USE_CLAUDE_CLI, AGENT_HINT, PERMISSIONS, ASK_ARGS };
