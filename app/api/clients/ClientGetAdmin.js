const winston = require( '../../../config/logger' )
const q2m = require( 'query-to-mongo' )
const UserAppClient = require( '../../../models/UserAppClient' )

module.exports = ( req, res ) => {
  let query = q2m( req.query )
  let finalCriteria = {}

  let andCrit = Object.keys( query.criteria ).map( key => {
    let crit = {}
    crit[key] = query.criteria[key]
    return crit
    } )

  if ( andCrit.length !== 0 ) finalCriteria.$and = andCrit

  UserAppClient.find( finalCriteria, query.options.fields, { sort: query.options.sort, skip: query.options.skip, limit: query.options.limit } )
    .then( clients => {
      if ( !clients ) throw new Error( 'Failed to find clients.' )
      res.send( { success: true, resources: clients } )
    } )
    .catch( err => {
      winston.error( err )
      res.status( 400 )
      res.send( { success: false, message: err.toString() } )
    } )
}
