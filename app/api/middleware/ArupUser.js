const jwt = require('jsonwebtoken')
const crypto = require('crypto')

module.exports = (req, res, next) => {
  if(!req.arupUser && req.headers.authorization) {
    const auth = jwt.decode(req.headers.authorization.replace('JWT ', ''))
    if(auth && auth.email && auth.email.includes('@arup.com')) {
      auth.emailHash = crypto.createHash('sha256').update(auth.email.trim().toLowerCase()).digest('hex')
      req.arupUser = auth
    }
  }
  next()
}