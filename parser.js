#!/usr/bin/env node

/**
 * OpenClaw Log Stream Parser for Activity Bot
 *
 * Parses OpenClaw gateway logs and forwards activity to a webhook
 * Usage: node parser.js | node bot.js
 *        OR: tail -f ~/.openclaw/logs/gateway.err.log | node parser.js
 */

const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

// Configuration - set via env vars or modify here
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3000/webhook';
const LOG_PATH = process.env.LOG_PATH || `${process.env.HOME}/.openclaw/logs/gateway.err.log`;

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Event type patterns
const PATTERNS = {
  discordMessage: /DiscordMessageListener took (\d+\.?\d*) seconds for event (\w+)/,
  toolCall: /\[tools\] (\w+)(?: started| called| completed| failed)/i,
  toolFailed: /\[tools\] exec failed:/i,
  agentWait: /agent\.wait (\d+)ms/i,
  sessionMemory: /\[session-memory\] Hook triggered/i,
  gatewayRestart: /gateway tool: restart requested/i,
  slowListener: /Slow listener detected: (\w+) took (\d+\.?\d*)ms for event (\w+)/,
  laneError: /lane task error:/i,
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
      type: 'discord_message',
      color: 'blurple',
      data: {
        event: discordMatch[2],
        duration: parseFloat(discordMatch[1]),
        raw: line,
      },
      timestamp,
    };
  }

  // Tool activity
  const toolMatch = line.match(PATTERNS.toolCall);
  if (toolMatch) {
    return {
      type: 'tool_activity',
      color: line.includes('failed') ? 'red' : 'green',
      data: {
        tool: toolMatch[1],
        status: line.includes('failed') ? 'failed' : 'completed',
        raw: line,
      },
      timestamp,
    };
  }

  // Agent activity
  const agentMatch = line.match(PATTERNS.agentWait);
  if (agentMatch) {
    return {
      type: 'agent_activity',
      color: 'yellow',
      data: {
        waitTime: parseInt(agentMatch[1]),
        raw: line,
      },
      timestamp,
    };
  }

  // Session activity
  const sessionMatch = line.match(PATTERNS.sessionMemory);
  if (sessionMatch) {
    return {
      type: 'session_activity',
      color: 'cyan',
      data: {
        action: 'memory_hook',
        raw: line,
      },
      timestamp,
    };
  }

  // Gateway activity
  const gatewayMatch = line.match(PATTERNS.gatewayRestart);
  if (gatewayMatch) {
    return {
      type: 'gateway_activity',
      color: 'orange',
      data: {
        action: 'restart',
        raw: line,
      },
      timestamp,
    };
  }

  // Slow listener warnings
  const slowMatch = line.match(PATTERNS.slowListener);
  if (slowMatch) {
    return {
      type: 'slow_listener',
      color: 'yellow',
      data: {
        listener: slowMatch[1],
        duration: parseFloat(slowMatch[2]),
        event: slowMatch[3],
        raw: line,
      },
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
 * Format activity for Discord embed
 */
function formatForDiscord(activity) {
  const { type, color, data, timestamp } = activity;

  const icons = {
    discord_message: '💬',
    tool_activity: data.status === 'failed' ? '❌' : '🔧',
    agent_activity: '🤖',
    session_activity: '💾',
    gateway_activity: '🔄',
    slow_listener: '⚠️',
  };

  const icon = icons[type] || '📌';
  const title = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  let description = '';
  
  switch (type) {
    case 'discord_message':
      description = `Event: \`${data.event}\`\nDuration: ${data.duration}s`;
      break;
    case 'tool_activity':
      description = `Tool: \`${data.tool}\`\nStatus: ${data.status}`;
      break;
    case 'agent_activity':
      description = `Wait time: ${data.waitTime}ms`;
      break;
    case 'slow_listener':
      description = `Listener: \`${data.listener}\`\nEvent: ${data.event}\nDuration: ${data.duration}ms`;
      break;
    default:
      description = data.raw.substring(0, 200);
  }

  return {
    icon,
    title,
    description,
    color,
    timestamp,
  };
}

/**
 * Send activity to webhook
 */
async function sendToWebhook(activity) {
  const formatted = formatForDiscord(activity);

  const payload = {
    type: 'activity',
    event_type: activity.type,
    formatted,
    raw: activity.data.raw,
    timestamp: activity.timestamp,
  };

  try {
    const url = new URL(WEBHOOK_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    await new Promise((resolve, reject) => {
      const req = client.request(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });

    // Log success to stderr (doesn't interfere with pipe)
    console.error(`${COLORS.green}✓${COLORS.reset} Sent: ${activity.type}`);
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
        // Output JSON to stdout (can be piped to another process)
        console.log(JSON.stringify(activity));
        
        // Also send to webhook
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

  console.error(`${COLORS.cyan}➤${COLORS.reset} Tailing ${LOG_PATH}`);
  console.error(`${COLORS.cyan}➤${COLORS.reset} Webhook: ${WEBHOOK_URL}`);
}

// Start
if (require.main === module) {
  tailLog();
}

module.exports = { parseLine, formatForDiscord, sendToWebhook };
