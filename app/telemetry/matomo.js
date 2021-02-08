const { isInteger } = require('lodash')
const MatomoTracker = require('matomo-tracker')

module.exports = (app) => {
  const matomoUrl = process.env.MATOMO_URL
  const matomoSite = process.env.MATOMO_SITE
  if(matomoUrl && matomoSite) {
    // Site "2" is speckle
    
    const matomo = new MatomoTracker(parseInt(matomoSite), matomoUrl)
    app.use(( req, res, next ) => {
      if(req.arupUser) {
        matomo.track({
          // This retrieves the full url including any ports
          url: req.protocol + '://' + req.get('host') + req.originalUrl,
          action_name: 'API call',
          ua: req.headers['user-agent'],
          // Auth0 ID
          _id: req.arupUser._id,
          lang: req.header('accept-language'),
          _cvar: JSON.stringify({
            '1': ['API version', 'v1'],
            '2': ['HTTP method', req.method]
          }),
          // Auth0 email address
          uid: req.arupUser.email
        })
      }
      next();
    })
  }
}