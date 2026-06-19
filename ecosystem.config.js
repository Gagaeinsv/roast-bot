# ecosystem.config.js — pm2 конфігурація

module.exports = {
  apps: [
    {
      name: 'roast-bot',
      script: 'src/bot.js',
      node_args: '--experimental-sqlite',
      restart_delay: 3000,
      max_restarts: 10,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
