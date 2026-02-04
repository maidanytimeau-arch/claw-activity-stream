module.exports = {
  apps: [
    {
      name: 'claw-activity-stream',
      script: '/opt/homebrew/bin/node',
      args: '/Users/bclawd/.openclaw/workspace/claw-activity-stream/src/index-enhanced.js',
      cwd: '/Users/bclawd/.openclaw/workspace/claw-activity-stream',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/stream-error.log',
      out_file: './logs/stream-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      name: 'claw-activity-parser',
      script: '/opt/homebrew/bin/node',
      args: '/Users/bclawd/.openclaw/workspace/claw-activity-stream/parser-enhanced.js',
      cwd: '/Users/bclawd/.openclaw/workspace/claw-activity-stream',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      error_file: './logs/parser-error.log',
      out_file: './logs/parser-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
