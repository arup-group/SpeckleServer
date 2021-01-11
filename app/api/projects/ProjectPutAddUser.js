const winston = require( '../../../config/logger' )

const Project = require( '../../../models/Project' )
const DataStream = require( '../../../models/DataStream' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = async ( req, res ) => {
  if ( !req.params.projectId || !req.params.userId )
    return res.status( 400 ).send( { success: false, message: 'No projectId or userId provided.' } )

  try {
    let project = await PermissionCheck( req.user, 'write', await Project.findOne( { _id: req.params.projectId } ) )
    let streams = await DataStream.find( { streamId: { $in: project.streams } }, 'canWrite canRead streamId owner projects jobNumber' )

    let streamEventData = [ ]
    if ( process.env.USE_KAFKA === 'true' ){
      for ( let stream of streams ) {
        let eventData = {
          eventType: 'stream-user-added',
          streamId: stream.streamId,
          streamJobNumber: stream.jobNumber,
          users: {
            owner: stream.owner,
            canRead: stream.canRead,
            canWrite: stream.canWrite,
            userAdded: req.params.userId
          }
        }
        streamEventData.push( eventData )
      }
    }

    await Promise.all( [
      DataStream.updateMany( { streamId: { $in: project.streams } }, { $addToSet: { canWrite: req.params.userId } } ),
      Project.updateOne( { _id: req.params.projectId }, { $addToSet: { 'canRead': req.params.userId, 'permissions.canWrite': req.params.userId } } )
    ] )

    if ( process.env.USE_KAFKA === 'true' ){
      let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
      let topic = process.env.KAFKA_TOPIC

      let eventData = [ {
        eventType: 'project-user-added',
        projectId: project.id,
        projectJobNumber: project.jobNumber,
        streams: project.streams,
        users: {
          owner: project.owner,
          canRead: project.canRead,
          canWrite: project.canWrite,
          userAdded: req.params.userId
        }
      } ]
      var events = streamEventData.concat( eventData )
      produceMsg( kafka, topic, events )
    }

    return res.send( { success: true, message:`Added user ${req.params.userId} to project ${req.params.projectId}'s permission table and updated streams.` } )
  } catch ( err ) {
    winston.error( JSON.stringify( err ) )
    res.status( err.message.indexOf( 'authorised' ) >= 0 ? 401 : 404 ).send( { success: false, message: err.message } )
  }
}
