const { Handlers } = require('@sentry/node')

module.exports = ( app ) => {
  app.use(Handlers.errorHandler());
}