const TransportStream = require('winston-transport');
const { Severity, configureScope, captureException, flush } = require('@sentry/node');

const DEFAULT_LEVELS_MAP = {
  silly: Severity.Debug,
  verbose: Severity.Debug,
  info: Severity.Info,
  debug: Severity.Debug,
  warn: Severity.Warning,
  error: Severity.Error,
}

class ExtendedError extends Error {
  constructor(info) {
    super(info.message);

    this.name = info.name || 'Error';
    if(info.stack) {
      this.stack = info.stack
    }
  }
}

//
// Inherit from `winston-transport` so you can take advantage
// of the base functionality and `.exceptions.handle()`.
//
module.exports = class SentryTransport extends TransportStream {
  constructor(opts) {
    super(opts);
    this.levelsMap = DEFAULT_LEVELS_MAP;
  }
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    const {
      message,
      level: winstonLevel,
      tags,
      user,
      ...meta
    } = info

    const sentryLevel = this.levelsMap[winstonLevel];

    configureScope(scope => {
      if(user) scope.setUser(user);
      scope.setExtras(meta);
      if(tags) scope.setTags(tags)
    })

    if([Severity.Fatal, Severity.Error].includes(sentryLevel)) {
      const error = message instanceof Error ? message : new ExtendedError(info)
      const event = captureException(error)
      return callback();
    }

    return callback();
  }

  end(...args) {
    flush().then( () => {
      super.end(...args)
    })
  }
};