'use strict'
const winston = require( '../../../config/logger' )

const DataStream = require( '../../../models/DataStream' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = ( req, res ) => {
  if ( !req.params.streamId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'No stream id provided.' } )
  }
  let myStream = null
  DataStream.findOne( { streamId: req.params.streamId }, 'owner children canRead canWrite jobNumber projects' )
    .then( stream => PermissionCheck( req.user, 'delete', stream ) )
    .then( stream => {
      myStream = stream
      return DataStream.deleteMany( { streamId: { $in: [ ...myStream.children, req.params.streamId ] } } )
    } )
    .then( ( ) => {
      return res.send( { success: true, message: `Stream ${req.params.streamId} and its children have been deleted.`, deletedStreams: [ ...myStream.children, req.params.streamId ] } )
    } )
    .then( ( ) => {
      if ( process.env.USE_KAFKA === 'true' ){
        let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
        let topic = process.env.KAFKA_TOPIC
        let eventData = [ {
          eventType: 'stream-deleted',
          streamId: req.params.streamId,
          streamJobNumber: myStream.jobNumber,
          users: {
            owner: myStream.owner,
            canRead: myStream.canRead,
            canWrite: myStream.canWrite,
          },
          children: myStream.children,
          projects: myStream.projects
        } ]
        produceMsg( kafka, topic, eventData )
      }
    } )
    .catch( err => {
      winston.error( JSON.stringify( err ) )
      res.status( err.message === 'Unauthorized. Please log in.' ? 401 : 404 )
      res.send( { success: false, message: err.toString( ) } )
    } )
}
