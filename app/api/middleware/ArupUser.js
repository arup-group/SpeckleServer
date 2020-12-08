const jwt = require('jsonwebtoken')

module.exports = (req, res, next) => {
  if(req.headers.authorization) {
    const auth = jwt.decode(req.headers.authorization.replace('JWT ', ''))
    if(auth && auth.email && auth.email.includes('@arup.com')) {
        req.arupUser = auth
    }
  }
  next()
}