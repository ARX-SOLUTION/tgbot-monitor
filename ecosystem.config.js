/**
 * PM2 Ecosystem Config
 * 
 * Usage:
 *   pm2 start ecosystem.config.js           # start all apps
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js          # zero-downtime reload
 *   pm2 stop ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 *   pm2 save                                # persist process list
 *   pm2 startup                             # auto-start on reboot
 */
module.exports = {
  apps: [
    {
      name: 'tgbot-monitor',
      script: './backend/dist/main.js',
      cwd: __dirname,

      // ── Cluster mode: 1 instance per CPU (Telegram bots use long-polling;
      //    use fork mode if you don't have a shared-session store like Redis)
      instances: 1,           // change to 'max' if you add Redis for sessions
      exec_mode: 'fork',      // switch to 'cluster' after adding Redis

      // ── Environment ──────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        DATA_DIR: './data',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATA_DIR: './data',
      },

      // ── Logging ──────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      out_file: './logs/app.log',
      error_file: './logs/error.log',
      merge_logs: true,
      max_size: '50M',
      rotate_interval: '1d',   // requires pm2-logrotate module

      // ── Restart policy ───────────────────────────────────────────────────
      max_restarts: 10,
      min_uptime: '10s',       // must stay up at least 10s to count as started
      restart_delay: 3000,     // wait 3s between restarts
      autorestart: true,
      exp_backoff_restart_delay: 100,

      // ── Memory guard ─────────────────────────────────────────────────────
      max_memory_restart: '500M',

      // ── Graceful shutdown ────────────────────────────────────────────────
      kill_timeout: 10000,     // give 10s to drain connections
      listen_timeout: 15000,

      // ── Watch (dev only) ─────────────────────────────────────────────────
      watch: false,
      ignore_watch: ['node_modules', 'data', 'logs', '*.db'],

      // ── Source maps ──────────────────────────────────────────────────────
      source_map_support: true,

      // ── Health check / liveness (PM2 v5+) ────────────────────────────────
      // health_check: {
      //   url: 'http://localhost:3000/api/stats/overview',
      //   interval: 30000,
      //   timeout: 5000,
      //   unhealthy_threshold: 3,
      // },
    },
  ],

  // ── Optional: deployment config ───────────────────────────────────────────
  // deploy: {
  //   production: {
  //     user: 'deploy',
  //     host: 'your-server.com',
  //     ref: 'origin/main',
  //     repo: 'git@github.com:yourname/tgbot-monitor.git',
  //     path: '/var/www/tgbot-monitor',
  //     'pre-deploy-local': '',
  //     'post-deploy': 'npm run build:all && pm2 reload ecosystem.config.js --env production',
  //   }
  // }
};
