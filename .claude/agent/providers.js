// Provider presets. Every provider here speaks the OpenAI-compatible
// /chat/completions API (with tools + streaming), so one client covers them all.
// Pick one with JARVIS_PROVIDER, or point JARVIS_BASE_URL at anything compatible.
'use strict';

const PRESETS = {
  // Free tier, no card needed. Key: https://aistudio.google.com/apikey
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    model: 'gemini-3.5-flash',
    fastModel: 'gemini-3.5-flash-lite',
  },
  // Free tier with generous rate limits. Key: https://console.groq.com/keys
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: ['GROQ_API_KEY'],
    model: null, fastModel: null, // set JARVIS_MODEL (see https://console.groq.com/docs/models)
  },
  // One key, hundreds of models, several of them free (":free" suffix).
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: ['OPENROUTER_API_KEY'],
    model: null, fastModel: null,
  },
  // 100% local and free. Install https://ollama.com, then e.g. `ollama pull qwen3`.
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    keyEnv: [],
    model: null, fastModel: null,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: ['OPENAI_API_KEY'],
    model: null, fastModel: null,
  },
  // Anthropic's OpenAI-SDK compatibility endpoint.
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    keyEnv: ['ANTHROPIC_API_KEY'],
    model: null, fastModel: null,
  },
};

function detectProvider(env) {
  if (env.JARVIS_PROVIDER) return env.JARVIS_PROVIDER.toLowerCase();
  if (env.JARVIS_BASE_URL) return 'custom';
  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) return 'gemini';
  if (env.GROQ_API_KEY) return 'groq';
  if (env.OPENROUTER_API_KEY) return 'openrouter';
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'gemini';
}

// "sonnet"/"haiku"/"opus" are what server.js historically asked the Claude CLI for.
// Map them onto the chosen provider's normal / fast model.
function resolveConfig(env, requestedModel) {
  const name = detectProvider(env);
  const preset = PRESETS[name] || { baseUrl: null, keyEnv: [], model: null, fastModel: null };
  const baseUrl = (env.JARVIS_BASE_URL || preset.baseUrl || '').replace(/\/+$/, '');
  let apiKey = env.JARVIS_API_KEY || '';
  for (const k of preset.keyEnv) if (!apiKey && env[k]) apiKey = env[k];

  const normal = env.JARVIS_MODEL || preset.model;
  const fast = env.JARVIS_FAST_MODEL || preset.fastModel || normal;
  let model = normal;
  if (requestedModel) {
    const r = requestedModel.toLowerCase();
    if (r === 'haiku' || r === 'fast') model = fast;
    else if (r === 'sonnet' || r === 'opus' || r === 'default') model = normal;
    else model = requestedModel; // an explicit model id wins
  }
  const problems = [];
  if (!baseUrl) problems.push('No base URL — set JARVIS_PROVIDER (gemini, groq, openrouter, ollama, openai, anthropic) or JARVIS_BASE_URL.');
  if (!model) problems.push('No model — set JARVIS_MODEL for provider "' + name + '".');
  if (!apiKey && name !== 'ollama' && name !== 'custom') {
    problems.push('No API key for "' + name + '" — set ' + (preset.keyEnv[0] || 'JARVIS_API_KEY') + ' in .env.');
  }
  return { provider: name, baseUrl, apiKey, model, problems };
}

module.exports = { PRESETS, resolveConfig };
