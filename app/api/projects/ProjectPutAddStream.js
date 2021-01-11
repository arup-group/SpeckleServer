const winston = require( '../../../config/logger' )

const Project = require( '../../../models/Project' )
const DataStream = require( '../../../models/DataStream' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = async ( req, res ) => {
  if ( !req.params.projectId || !req.params.streamId )
    return res.status( 400 ).send( { success: false, message: 'No projectId or streamId provided.' } )

  try {
    let project = await PermissionCheck( req.user, 'write', await Project.findOne( { _id: req.params.projectId } ) )
    let stream = await PermissionCheck( req.user, 'write', await DataStream.findOne( { streamId: req.params.streamId }, 'canRead canWrite name streamId owner jobNumber projects' ) )

    if ( !project || !stream )
      return res.status( 400 ).send( { success: false, message: 'Could not find project or stream.' } )

    project.streams.indexOf( stream.streamId ) === -1 ? project.streams.push( stream.streamId ) : null

    stream.projects.indexOf( project.id ) === -1 ? stream.projects.push( project.id ) : null

    project.permissions.canRead.forEach( id => {
      stream.canRead.indexOf( id ) === -1 ? stream.canRead.push( id ) : null
    } )

    stream.canRead.indexOf( project.owner ) === -1 ? stream.canRead.push( project.owner ) : null

    project.permissions.canWrite.forEach( id => {
      stream.canWrite.indexOf( id ) === -1 ? stream.canWrite.push( id ) : null
    } )

    stream.canWrite.indexOf( project.owner ) === -1 ? stream.canWrite.push( project.owner ) : null

    await Promise.all( [ stream.save( ), project.save( ) ] )
    if ( process.env.USE_KAFKA === 'true' ){
      let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
      let topic = process.env.KAFKA_TOPIC
      let eventData = [ {
        eventType: 'project-stream-added',
        projectId: project.id,
        projectJobNumber: project.jobNumber,
        streams: {
          streamAdded: stream.streamId,
          stream: project.streams
        }
      },
      {
        eventType: 'stream-project-added',
        streamId: stream.streamId,
        streamJobNumber: stream.jobNumber,
        projects: {
          projectAdded: project.id,
          projects: stream.projects
        }
      } ]
      produceMsg( kafka, topic, eventData )
    }
    return res.send( { success: true, project: project, stream: stream } )
  } catch ( err ) {
    winston.error( JSON.stringify( err ) )
    res.status( 400 ).send( { success: false, message: err.message } )
  }
}