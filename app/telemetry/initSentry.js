const { Integrations, init, setUser } = require('@sentry/node')
const Tracing = require('@sentry/tracing')
const { Handlers } = require('@sentry/node')

module.exports = ( app ) => {
  init({ 
    integrations: [
      new Integrations.Http({
        tracing: true
      }),
      new Tracing.Integrations.Express({ app })
    ],
    release: process.env.SPECKLE_API_VERSION || 'local',
    sampleRate: process.env.SENTRY_SAMPLE_RATE ? parseFloat(process.env.SENTRY_SAMPLE_RATE) : 0.0,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_SAMPLE_RATE) : 0.0
  });

  app.use((req, res, next) => {
    // Only set user for Arup users
    if(req.arupUser) {
    // Store email address if user is an Arup employee.
      setUser({
        email: req.arupUser.email,
        id: req.arupUser._id,
        username: req.arupUser.name
      })
    }
    next()
  })

  app.use((req, res, next) => {
    if (req.arupUser) {
      Handlers.requestHandler()(req, res, next)
    } else {
      next()
    }
  })

  app.use((req, res, next) => {
    if (req.arupUser) {
      Handlers.tracingHandler()(req, res, next)
    } else {
      next()
    }
  })

}