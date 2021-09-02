'use strict'
const winston = require( '../../../config/logger' )
const jwt = require( 'jsonwebtoken' )

const User = require( '../../../models/User' )

module.exports = function( req, res ) {
  if ( !req.body._id ) {
    res.status( 400 )
    res.send( { success: false, message: 'Malformed request.' } )
  }

  User.findOne( { '_id': req.body._id }, '-password' )
    .then( myUser => {
      if ( !myUser ) {
        winston.error( 'Invalid credentials.' )
        return res.status( 401 ).send( { success: false, message: 'Invalid credentials.' } )
      }

      let newApiToken = 'JWT ' + jwt.sign( { _id: myUser._id }, process.env.SESSION_SECRET, { expiresIn: '90d' } )
      myUser.apitoken = newApiToken
      myUser.markModified( 'apitoken' )

      myUser.save()

      res.send( { success: true, message: 'User API token refreshed.', resource: myUser } )
    } )
    .catch( err => {
      winston.error( err )
      res.status( 401 ).send( { success: false, message: err } )
    } )
}
