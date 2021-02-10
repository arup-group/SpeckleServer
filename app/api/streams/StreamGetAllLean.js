const winston = require( '../../../config/logger' )
const mongoose = require( 'mongoose' )
const q2m = require( 'query-to-mongo' )

const DataStream = require( '../../../models/DataStream' )

module.exports = ( req, res ) => {
  winston.debug( 'Getting *all* streams for user (lean response).' )
  let userSelect = '_id name surname email company'

  // prepare query
  let query = q2m( req.query )

  let finalCriteria = {}

  // perpare array for $and coming from url params
  // delete populate permission field if present, as it hijacks the actual query criteria
  if ( query.criteria.populatePermissions ) delete query.criteria.populatePermissions

  finalCriteria.$and = [
    { isComputedResult: false },
    { deleted: false },
  ]

  // the user query itself that gets both owned and shared with streams
  finalCriteria.$or = [
    { owner: req.user._id },
    { 'canWrite': mongoose.Types.ObjectId( req.user._id ) },
    { 'canRead': mongoose.Types.ObjectId( req.user._id ) }
  ]

  let fieldOptions = {
    streamId: 1,
    name: 1,
    description: 1,
    parent: 1,
    children: 1,
    ancestors: 1,
    tags: 1,
    layers: 1,
  }

  let sortOptions = {
    updatedAt: -1
  }

  DataStream.find( finalCriteria, fieldOptions, { sort: sortOptions, skip: query.options.skip, limit: query.options.limit } )
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

      res.send( { success: true, message: 'Stream list returned. Contains both owned and shared with streams.', resources: streams } )
    } )
    .catch( err => {
      winston.error( err )
      res.status( 400 )
      res.send( { success: false, message: 'Something failed.' } )
    } )
}
