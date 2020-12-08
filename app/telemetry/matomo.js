const MatomoTracker = require('matomo-tracker')
const logger = require( '../../config/logger' )




module.exports = (app) => {
  const matomo = new MatomoTracker(1, 'https://oasyssoftware.matomo.cloud/matomo.php')
  app.use(( req, res, next ) => {
    logger.info(req.user)
    const arupUser = req.user && req.user.email && req.user.email.includes('@arup.com')
    if(arupUser) {
      matomo.track({
        url: req.baseUrl + req.url,
        action_name: 'API call',
        ua: req.header('User-Agent'),
        lang: req.header('Accept-Language'),
        cvar: JSON.stringify({
          '1': ['API version', 'v1'],
          '2': ['HTTP method', req.method]
        }),
        uid: req.user.email
      })
    }
    next();
  })
}