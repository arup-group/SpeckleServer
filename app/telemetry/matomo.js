const { isInteger } = require('lodash')
const MatomoTracker = require('matomo-tracker')

module.exports = (app) => {
  const matomoUrl = process.env.MATOMO_URL
  const matomoSite = process.env.MATOMO_SITE
  if(matomoUrl && matomoSite) {
    const matomo = new MatomoTracker(parseInt(matomoSite), matomoUrl)
    app.use(( req, res, next ) => {
      if(req.arupUser) {
        matomo.track({
          // This retrieves the full url including any ports
          url: req.protocol + '://' + req.get('host') + req.originalUrl,
          action_name: 'API call',
          ua: req.headers['user-agent'],
          // Auth0 ID
          _id: req.arupUser.emailHash,
          lang: req.header('accept-language'),
          _cvar: JSON.stringify({
            '1': ['API version', 'v1'],
            '2': ['HTTP method', req.method]
          }),
          // Auth0 ID
          uid: req.arupUser.emailHash
        })
      }
      next();
    })
  }
}