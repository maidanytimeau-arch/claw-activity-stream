#!/usr/bin/env node

/**
 * Claw Activity Stream Bot
 *
 * Receives activity events via webhook and posts to Discord
 * Usage: node bot.js
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Discord configuration
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

// Color mapping for Discord embeds
const DISCORD_COLORS = {
  blurple: 0x5865F2,
  green: 0x57F287,
  red: 0xED4245,
  yellow: 0xFEE75C,
  orange: 0xFF9F43,
  cyan: 0x00FFFF,
  gray: 0x99AAB5,
};

/**
 * Post to Discord webhook
 */
async function postToDiscord(activity) {
  if (!DISCORD_WEBHOOK_URL) {
    console.warn('No Discord webhook configured, skipping');
    return;
  }

  const { formatted } = activity;
  const color = DISCORD_COLORS[formatted.color] || DISCORD_COLORS.gray;

  const embed = {
    title: `${formatted.icon} ${formatted.title}`,
    description: formatted.description,
    color: color,
    timestamp: formatted.timestamp,
    footer: {
      text: 'Claw Activity Stream',
    },
  };

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    console.log(`✓ Posted to Discord: ${activity.type}`);
  } catch (err) {
    console.error(`✗ Discord error: ${err.message}`);
  }
}

/**
 * Activity queue with rate limiting
 */
const activityQueue = [];
let isProcessing = false;

const RATE_LIMIT = {
  // Max posts per minute
  maxPerMinute: 10,
  posts: [],
};

function checkRateLimit() {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  // Clean old posts
  RATE_LIMIT.posts = RATE_LIMIT.posts.filter(time => time > oneMinuteAgo);

  return RATE_LIMIT.posts.length < RATE_LIMIT.maxPerMinute;
}

async function processQueue() {
  if (isProcessing || activityQueue.length === 0) {
    return;
  }

  isProcessing = true;

  while (activityQueue.length > 0) {
    if (!checkRateLimit()) {
      // Wait if rate limited
      console.log('Rate limit reached, waiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      continue;
    }

    const activity = activityQueue.shift();
    RATE_LIMIT.posts.push(Date.now());

    try {
      await postToDiscord(activity);
    } catch (err) {
      console.error(`Failed to post ${activity.type}: ${err.message}`);
    }

    // Small delay between posts
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  isProcessing = false;
}

/**
 * Webhook endpoint
 */
app.post('/webhook', express.json(), (req, res) => {
  const activity = req.body;

  console.log(`Received: ${activity.type}`);

  // Add to queue
  activityQueue.push(activity);

  // Process queue
  processQueue();

  res.json({ ok: true });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    queue: activityQueue.length,
    rateLimit: {
      posts: RATE_LIMIT.posts.length,
      maxPerMinute: RATE_LIMIT.maxPerMinute,
    },
  });
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 Claw Activity Stream Bot listening on port ${PORT}`);
  console.log(`📡 Webhook endpoint: http://localhost:${PORT}/webhook`);
  
  if (DISCORD_WEBHOOK_URL) {
    console.log(`💬 Discord webhook configured`);
  } else {
    console.warn(`⚠️  No Discord webhook configured (set DISCORD_WEBHOOK_URL)`);
  }
});
