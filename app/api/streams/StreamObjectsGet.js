'use strict'
const winston = require( '../../../config/logger' )
const q2m = require( 'query-to-mongo' )

const DataStream = require( '../../../models/DataStream' )
const SpeckleObject = require( '../../../models/SpeckleObject' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = ( req, res ) => {

  if ( !req.params.streamId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'No stream id provided.' } )
  }

  let streamObjects = [ ]
  DataStream.findOne( { streamId: req.params.streamId } )
    .then( stream => PermissionCheck( req.user, 'read', stream ) )
    .then( stream => {
      streamObjects = stream.objects.map( o => o.toString( ) )
      let query = q2m( req.query )

      // set max of 5000 objects retrieved per request
      if ( query.options.limit > 5000 ) {
        winston.error( 'More than 5000 objects requested.' )
        res.status( 400 )
        return res.send( { success: false, message: 'A limit of 5000 objects per call can be returned. Please add a skip parameter to your request.' } )
      }

      // set default of 2000 objects retrieved per request
      if ( !query.options.limit ) query.options.limit = 2000

      query.criteria[ '_id' ] = { $in: stream.objects }
      return SpeckleObject.find( query.criteria, query.options.fields, { sort: query.options.sort, skip: query.options.skip, limit: query.options.limit } )
    } )
    .then( objects => {
      let list = streamObjects.reduce( ( arr, o ) => {
        let match = objects.find( oo => oo._id == o )
        if ( match ) arr.push( match )
        return arr
      }, [ ] )
      res.send( { success: true, resources: list, message: 'Object list returned. If querying, duplication of objects in list will not be respected. Unless specified through adding a limit parameter, a default of 2000 objects is returned per request.' } )
    } )
    .catch( err => {
      winston.error( err )
      res.status( err.message === 'Unauthorized. Please log in.' ? 401 : 404 )
      res.send( { success: false, message: err.message, streamId: req.params.streamId } )
    } )
}
