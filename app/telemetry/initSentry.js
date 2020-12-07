const { Integrations, init, setUser } = require('@sentry/node')
const Tracing = require('@sentry/tracing')
const { Handlers } = require('@sentry/node')

module.exports = ( app ) => {
  init({ 
    dsn: "https://16316fb314584d76b3d6f3bedacb7392@o458796.ingest.sentry.io/5497340",
    integrations: [
      new Integrations.Http({
        tracing: true
      }),
      new Tracing.Integrations.Express({ app })
    ],
    release: process.env.SPECKLE_API_VERSION || 'local',
    environment: process.env.SENTRY_ENVIRONMENT || 'local',
    sampleRate: process.env.SENTRY_SAMPLE_RATE ? parseFloat(process.env.SENTRY_SAMPLE_RATE) : 0.0,
    tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE ? parseFloat(process.env.SENTRY_SAMPLE_RATE) : 0.0
  });

  // The request handler must be the first middleware on the app
  app.use(Handlers.requestHandler());
  // TracingHandler creates a trace for every incoming request
  app.use(Handlers.tracingHandler());

  app.use((req, res, next) => {
    // Store email address if user is an Arup employee.
    setUser({
      email: req.user && req.user.email && req.user.email.includes('@arup.com') ? req.user.email : 'unknown',
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    })
    next()
  })
}