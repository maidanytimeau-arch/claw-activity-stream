#!/usr/bin/env node

/**
 * OpenClaw Log Stream Parser
 *
 * Parses OpenClaw gateway logs and forwards to claw-activity-stream bot
 * Usage: node parser-claw.js
 */

const { spawn } = require('child_process');

// Configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook/activity';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'claw-secret-key-change-in-production-2024';
const LOG_PATH = process.env.LOG_PATH || `${process.env.HOME}/.openclaw/logs/gateway.err.log`;

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Event type patterns (matching OpenClaw logs)
const PATTERNS = {
  discordMessage: /DiscordMessageListener took (\d+\.?\d*) seconds for event (\w+)/,
  toolCall: /\[tools\] (\w+)(?: started| completed| failed)/i,
  toolFailed: /\[tools\] exec failed:/i,
  agentWait: /agent\.wait (\d+)ms/i,
  sessionMemory: /\[session-memory\] Hook triggered/i,
  gatewayRestart: /gateway tool: restart requested/i,
  slowListener: /Slow listener detected: (\w+) took (\d+\.?\d*)ms for event (\w+)/,
  laneError: /lane task error:/i,
  agentResponse: /\[agent:nested\] session=/i,
};

/**
 * Parse a log line and extract activity event
 */
function parseLine(line) {
  const timestamp = extractTimestamp(line);

  // Discord message activity
  const discordMatch = line.match(PATTERNS.discordMessage);
  if (discordMatch) {
    return {
      type: 'process',
      message: `Discord ${discordMatch[2]} event`,
      metadata: {
        duration: `${parseFloat(discordMatch[1]).toFixed(2)}s`,
        event: discordMatch[2],
      },
      timestamp,
    };
  }

  // Tool activity - success
  const toolMatch = line.match(PATTERNS.toolCall);
  if (toolMatch && !line.includes('failed')) {
    return {
      type: 'tool_call',
      tool: toolMatch[1],
      result: { status: 'completed' },
      timestamp,
    };
  }

  // Tool activity - failed
  if (line.match(PATTERNS.toolFailed)) {
    // Extract tool name from context
    const toolNameMatch = line.match(/tool "(\w+)"/);
    const toolName = toolNameMatch ? toolNameMatch[1] : 'unknown';
    
    return {
      type: 'error',
      tool: toolName,
      error: 'Tool execution failed',
      metadata: { raw: line.substring(0, 200) },
      timestamp,
    };
  }

  // Agent activity
  const agentMatch = line.match(PATTERNS.agentWait);
  if (agentMatch) {
    return {
      type: 'process',
      message: `Agent wait time`,
      metadata: { waitTime: `${agentMatch[1]}ms` },
      timestamp,
    };
  }

  // Session activity
  const sessionMatch = line.match(PATTERNS.sessionMemory);
  if (sessionMatch) {
    return {
      type: 'info',
      message: 'Session memory hook triggered',
      timestamp,
    };
  }

  // Gateway activity
  const gatewayMatch = line.match(PATTERNS.gatewayRestart);
  if (gatewayMatch) {
    return {
      type: 'process',
      message: 'Gateway restart requested',
      timestamp,
    };
  }

  // Slow listener warnings
  const slowMatch = line.match(PATTERNS.slowListener);
  if (slowMatch) {
    return {
      type: 'process',
      message: `Slow ${slowMatch[1]}`,
      metadata: {
        listener: slowMatch[1],
        event: slowMatch[3],
        duration: `${parseFloat(slowMatch[2]).toFixed(0)}ms`,
      },
      timestamp,
    };
  }

  // Lane errors
  const laneErrorMatch = line.match(PATTERNS.laneError);
  if (laneErrorMatch) {
    return {
      type: 'error',
      error: 'Lane task error',
      metadata: { raw: line.substring(0, 200) },
      timestamp,
    };
  }

  // Agent nested sessions
  const agentResponseMatch = line.match(PATTERNS.agentResponse);
  if (agentResponseMatch) {
    return {
      type: 'process',
      message: 'Nested agent session',
      metadata: { session: line.substring(0, 100) },
      timestamp,
    };
  }

  return null;
}

/**
 * Extract ISO timestamp from log line
 */
function extractTimestamp(line) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
  return match ? match[1] : new Date().toISOString();
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

    // Log success to stderr (doesn't interfere with pipe)
    const typeShort = activity.type.substring(0, 8);
    console.error(`${COLORS.green}✓${COLORS.reset} [${typeShort}] ${activity.message || activity.tool || activity.type}`);
  } catch (err) {
    console.error(`${COLORS.red}✗${COLORS.reset} Failed to send: ${err.message}`);
  }
}

/**
 * Start tailing the log file
 */
function tailLog() {
  const tail = spawn('tail', ['-F', '-n', '0', LOG_PATH]);

  tail.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l.trim());

    for (const line of lines) {
      const activity = parseLine(line);
      if (activity) {
        // Send to webhook
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
    console.error(`${COLORS.red}Failed to tail log:${COLORS.reset} ${err.message}`);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    tail.kill();
    console.error('\nStopped tailing logs');
    process.exit(0);
  });

  console.error(`${COLORS.cyan}➤${COLORS.reset} OpenClaw Log Parser`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Watching: ${LOG_PATH}`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Webhook: ${WEBHOOK_URL}`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Waiting for activity...\n`);
}

// Start
if (require.main === module) {
  tailLog();
}

module.exports = { parseLine, sendToWebhook };
