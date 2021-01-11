const winston = require( '../../../config/logger' )
const shortId = require( 'shortid' )

const DataStream = require( '../../../models/DataStream' )
const BulkObjectSave = require( '../middleware/BulkObjectSave' )

module.exports = ( req, res ) => {
  if ( !req.body.objects ) req.body.objects = [ ]

  BulkObjectSave( req.body.objects, req.user )
    .then( objects => {
      let stream = new DataStream( req.body )
      stream.owner = req.user._id
      stream.streamId = shortId()
      stream.objects = objects.map( obj => obj._id )
      return stream.save()
    } )
    .then( stream => {
      stream = stream.toObject()
      stream.objects = stream.objects.map( id => { return { type: 'Placeholder', _id: id } } )
      res.send( { success: true, resource: stream, message: 'Created stream' } )
      return stream
    } )
    .then(  stream => {
      if ( process.env.USE_KAFKA === 'true' ){
        let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
        let topic = process.env.KAFKA_TOPIC
        let eventData = [ {
          eventType: 'stream-created',
          streamId: stream.streamId,
          streamJobNumber: stream.jobNumber,
          users: {
            owner: stream.owner,
            canRead: stream.canRead,
            canWrite: stream.canWrite,
          }
        } ]
        produceMsg( kafka, topic, eventData )
      }
    } )
    .catch( err => {
      winston.error( JSON.stringify( err ) )
      res.status( 400 )
      return res.send( { success: false, message: err.toString() } )
    } )
}
