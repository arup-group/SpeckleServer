const { Handlers } = require('@sentry/node')

module.exports = ( app ) => {
  app.use((error, req, res, next) => {
    if(req.arupUser) {
      Handlers.errorHandler()(error, req, res, next)
    } else {
      next()
    }
  })
}