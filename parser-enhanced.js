#!/usr/bin/env node

/**
 * OpenClaw Session Stream Parser (Enhanced)
 *
 * Parses .jsonl session files and forwards to claw-activity-stream bot
 * Based on openclaw-discord-audit event formatting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/activity';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'claw-secret-key-change-in-production-2024';
const SESSIONS_DIR = process.env.SESSIONS_DIR || `${process.env.HOME}/.openclaw/agents/main/sessions`;

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Tool name mapping for icons (inspired by openclaw-discord-audit)
const TOOL_ICONS = {
  // File operations
  read: '📂',
  write: '💾',
  edit: '✏️',

  // Web tools
  web_search: '🔎',
  web_fetch: '🌐',
  browser: '🖥️',

  // Memory
  memory_search: '🧠',
  memory_get: '🧠',

  // Sessions
  sessions_list: '📡',
  sessions_spawn: '📡',
  sessions_send: '📡',
  sessions_history: '📡',

  // Messaging
  message: '💬',
  send: '💬',
  react: '💬',
  delete: '💬',
  edit: '✏️',

  // Other
  exec: '⚡',
  cron: '🔧',
  tts: '🔊',
};

// Generic tool icon fallback
const GENERIC_ICON = '🔧';

/**
 * Parse a JSON line from session file
 */
function parseSessionLine(line) {
  try {
    const event = JSON.parse(line);
    const timestamp = event.timestamp || new Date().toISOString();

    // Handle message events (most common)
    if (event.type === 'message' && event.message) {
      return parseMessageEvent(event);
    }

    // Handle custom events
    if (event.type === 'custom') {
      return parseCustomEvent(event);
    }

    // Handle session events
    if (event.type === 'session') {
      return {
        type: 'info',
        icon: '📡',
        message: 'Session updated',
        timestamp,
      };
    }

    // Handle model change events
    if (event.type === 'model_change') {
      return {
        type: 'info',
        icon: '🔄',
        message: `Model changed to ${event.model}`,
        timestamp,
      };
    }

    return null;
  } catch (err) {
    console.error(`${COLORS.yellow}Failed to parse JSON:${COLORS.reset}`, err.message);
    return null;
  }
}

/**
 * Parse message event and extract tool calls, thinking, etc.
 */
function parseMessageEvent(event) {
  const msg = event.message;
  const timestamp = event.timestamp;

  // Skip if no content
  if (!msg.content || !Array.isArray(msg.content)) {
    return null;
  }

  // Extract thinking (reasoning)
  const thinkingContent = msg.content.find(c => c.type === 'thinking' && c.thinking);
  if (thinkingContent) {
    return {
      type: 'thinking',
      icon: '💭',
      reasoning: thinkingContent.thinking,
      timestamp,
    };
  }

  // Extract tool calls from assistant messages
  if (msg.role === 'assistant') {
    const toolCalls = msg.content.filter(c =>
      c.type === 'tool_use' && c.name && c.id
    );

    if (toolCalls.length > 0) {
      // Return first tool call (we'll process them individually)
      const toolCall = toolCalls[0];
      return {
        type: 'tool_call',
        icon: TOOL_ICONS[toolCall.name] || GENERIC_ICON,
        tool: toolCall.name,
        args: toolCall.input,
        toolCallId: toolCall.id,
        timestamp,
      };
    }

    // Text output from assistant
    const textContent = msg.content.find(c => c.type === 'text' && c.text);
    if (textContent) {
      return {
        type: 'text_output',
        icon: '💬',
        message: textContent.text.substring(0, 300), // Truncate long responses
        timestamp,
      };
    }
  }

  // Tool results
  if (msg.role === 'tool') {
    const toolName = msg.tool_use_id ? extractToolNameFromId(msg.tool_use_id) : 'unknown';
    const success = !msg.content?.toLowerCase().includes('error');

    return {
      type: 'tool_result',
      icon: success ? '✓' : '❌',
      tool: toolName,
      success,
      result: msg.content,
      timestamp,
    };
  }

  // User messages (incoming)
  if (msg.role === 'user') {
    const textContent = msg.content.find(c => c.type === 'text' && c.text);
    if (textContent) {
      return {
        type: 'user_message',
        icon: '📨',
        message: textContent.text.substring(0, 200),
        timestamp,
      };
    }
  }

  return null;
}

/**
 * Parse custom events
 */
function parseCustomEvent(event) {
  const timestamp = event.timestamp;

  if (event.customType === 'model-snapshot') {
    return {
      type: 'info',
      icon: '📊',
      message: 'Model usage snapshot',
      metadata: {
        model: event.data?.model,
        tokens: event.data?.usage?.totalTokens,
      },
      timestamp,
    };
  }

  return null;
}

/**
 * Extract tool name from tool_use_id (hacky but works for matching)
 */
function extractToolNameFromId(toolId) {
  // In OpenClaw session files, tool calls are in preceding messages
  // We'd need to track state, but for now we'll just return generic
  return 'tool_result';
}

/**
 * Send activity to webhook
 */
async function sendToWebhook(activity) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify(activity),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    // Log success to stderr
    const icon = activity.icon || '📡';
    const typeShort = activity.type.substring(0, 12);
    console.error(`${COLORS.green}✓${COLORS.reset} ${icon} [${typeShort.padEnd(12)}] ${activity.message || activity.tool || activity.reasoning?.substring(0, 30) || ''}`);
  } catch (err) {
    console.error(`${COLORS.red}✗${COLORS.reset} Failed to send: ${err.message}`);
  }
}

/**
 * Start tailing all session files
 */
function tailSessionFiles() {
  // Get all active .jsonl files (exclude deleted)
  const sessionFiles = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted.'))
    .map(f => path.join(SESSIONS_DIR, f));

  if (sessionFiles.length === 0) {
    console.error(`${COLORS.yellow}No session files found in ${SESSIONS_DIR}${COLORS.reset}`);
    console.error(`${COLORS.cyan}➤${COLORS.reset} Waiting for session files to appear...`);
  }

  console.error(`${COLORS.cyan}➤${COLORS.reset} Enhanced Session Parser`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Watching ${sessionFiles.length} session files`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Webhook: ${WEBHOOK_URL}`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Waiting for activity...\n`);

  // Tail each file
  const tailProcesses = sessionFiles.map(filePath => {
    const tail = spawn('tail', ['-F', '-n', '0', filePath]);

    tail.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());

      for (const line of lines) {
        const activity = parseSessionLine(line);
        if (activity) {
          sendToWebhook(activity).catch(err => {
            console.error(`${COLORS.red}Webhook error: ${err.message}${COLORS.reset}`);
          });
        }
      }
    });

    tail.stderr.on('data', (data) => {
      console.error(`${COLORS.yellow}[tail stderr]${COLORS.reset} ${data}`);
    });

    tail.on('error', (err) => {
      console.error(`${COLORS.red}Failed to tail ${filePath}:${COLORS.reset} ${err.message}`);
    });

    return tail;
  });

  // Watch for new session files
  const watcher = fs.watch(SESSIONS_DIR, (eventType, filename) => {
    if (eventType === 'rename' && filename && filename.endsWith('.jsonl') && !filename.includes('.deleted.')) {
      const newPath = path.join(SESSIONS_DIR, filename);
      console.error(`${COLORS.green}+${COLORS.reset} New session file: ${filename}`);

      const tail = spawn('tail', ['-F', '-n', '0', newPath]);
      tail.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter(l => l.trim());
        for (const line of lines) {
          const activity = parseSessionLine(line);
          if (activity) sendToWebhook(activity);
        }
      });
      tail.on('error', err => {
        console.error(`${COLORS.red}Failed to tail new file:${COLORS.reset} ${err.message}`);
      });
      tailProcesses.push(tail);
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    tailProcesses.forEach(t => t.kill());
    watcher.close();
    console.error('\nStopped tailing session files');
    process.exit(0);
  });
}

// Start
if (require.main === module) {
  tailSessionFiles();
}

module.exports = { parseSessionLine, sendToWebhook };
