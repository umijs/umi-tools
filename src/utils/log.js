const { Signale } = require('signale');

module.exports = new Signale({
  types: {
    transform: {
      badge: '🎅',
      color: 'blue',
      label: 'transform',
    },
    pending: {
      badge: '++',
      color: 'magenta',
      label: 'pending'
    },
    watch: {
      badge: '**',
      color: 'yellow',
      label: 'watch'
    },
  }
});
