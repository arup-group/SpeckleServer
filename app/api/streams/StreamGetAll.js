const winston = require( '../../../config/logger' )
const mongoose = require( 'mongoose' )
const q2m = require( 'query-to-mongo' )

const DataStream = require( '../../../models/DataStream' )

module.exports = ( req, res ) => {
  winston.debug( 'Getting *all* streams for user.' )
  let userSelect = '_id name surname email company'

  // prepare query
  let query = q2m( req.query )

  // set max of 500 streams retrieved per request
  if ( query.options.limit > 500 ) {
    winston.error( 'More than 500 streams requested.' )
    res.status( 400 )
    return res.send( { success: false, message: 'A limit of 500 streams per call can be returned. Please add a skip parameter to your request.' } )
  }

  let finalCriteria = {}

  // perpare array for $and coming from url params
  // delete populate permission field if present, as it hijacks the actual query criteria
  if ( query.criteria.populatePermissions ) delete query.criteria.populatePermissions
  let andCrit = Object.keys( query.criteria ).map( key => {
    let crit = {}
    crit[ key ] = query.criteria[ key ]
    return crit
  } )

  // if we actually have any query params, include them
  if ( andCrit.length !== 0 ) finalCriteria.$and = andCrit

  // the user query itself that gets both owned and shared with streams
  finalCriteria.$or = [
    { owner: req.user._id },
    { 'canWrite': mongoose.Types.ObjectId( req.user._id ) },
    { 'canRead': mongoose.Types.ObjectId( req.user._id ) }
    // { 'private': false }
  ]

  // set default of 200 streams retrieved per request
  if ( !query.options.limit ) query.options.limit = 200

  DataStream.find( finalCriteria, query.options.fields, { sort: query.options.sort, skip: query.options.skip, limit: query.options.limit } )
    .populate( { path: 'canRead', select: userSelect } )
    .populate( { path: 'canWrite', select: userSelect } )
    .then( myStreams => {
      let resources = myStreams
      try {
        if ( !req.query.populatePermissions ) {
          resources.forEach( stream => {
            if ( stream.owner ) stream.owner = stream.owner._id
            if ( stream.canRead ) stream.canRead = stream.canRead.map( u => u._id )
            if ( stream.canWrite ) stream.canWrite = stream.canWrite.map( u => u._id )
          } )
        }
      } catch ( e ) {
        winston.debug( e.message )
      }

      let streams = [ ]
      resources.forEach( ( stream, i ) => {
        streams.push( stream.toObject( ) )
        if ( streams[ i ].objects ) streams[ i ].objects = streams[ i ].objects.map( o => { return { _id: o.toString( ), type: 'Placeholder' } } )
      } )

      res.send( { success: true, message: 'Stream list returned. Contains both owned and shared with streams. Unless specified through adding a limit parameter, a default of 200 streams is returned per request.', resources: streams } )
    } )
    .catch( err => {
      winston.error( err )
      res.status( 400 )
      res.send( { success: false, message: 'Something failed.' } )
    } )
}
