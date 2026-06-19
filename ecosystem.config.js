module.exports = {
  apps: [{
    name: 'roast-bot',
    script: 'src/bot.js',
    node_args: '--experimental-sqlite',
    restart_delay: 3000,
    max_restarts: 10,
    autorestart: true,
    watch: false,
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
