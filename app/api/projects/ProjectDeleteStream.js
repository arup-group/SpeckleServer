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

    project.streams.indexOf( stream.streamId ) === -1 ? null : project.streams.splice( project.streams.indexOf( stream.streamId ), 1 )

    stream.projects.indexOf( project.id ) === -1 ? null : stream.projects.splice( stream.projects.indexOf( project.id ), 1 )

    let otherProjects = await Project.find( { 'streams': stream.streamId, _id: { $ne: project._id } } )

    // Replaced these two with a gross forEach method below because casting Mongoose Arrays to
    // normal Javascript Arrays removes certain comparative properties when it comes to bson _id
    // objects. Check this link for vague explanations: https://stackoverflow.com/questions/41063587/mongoose-indexof-in-an-objectid-array

    // let otherCW = Array.prototype.concat( ...otherProjects.map( p => p.permissions.canWrite ) )
    // let otherCR = Array.prototype.concat( ...otherProjects.map( p => p.permissions.canRead ) )

    project.permissions.canRead.forEach( id => {
      let index = stream.canRead.indexOf( id )
      let canReadOther = false;
      otherProjects.forEach( p => {
        if ( p.permissions.canRead.indexOf( id ) > -1 ) {
          canReadOther = true;
        }
      } );
      if ( !canReadOther && index > -1 ) {
        stream.canRead.splice( index, 1 )
      }
    } )

    project.permissions.canWrite.forEach( id => {
      let index = stream.canWrite.indexOf( id )
      let canWriteOther = false;
      otherProjects.forEach( p => {
        if ( p.permissions.canWrite.indexOf( id ) > -1 ) {
          canWriteOther = true;
        }
      } );
      if ( !canWriteOther && index > -1 ) {
        stream.canWrite.splice( index, 1 )
      }
    } )

    await Promise.all( [ stream.save( ), project.save( ) ] )
    if ( process.env.USE_KAFKA === 'true' ){
      let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
      let eventData = [ {
        eventType: 'project-stream-removed',
        projectId: project.id,
        projectJobNumber: project.jobNumber,
        streams: {
          streamRemoved: stream.streamId,
          streams: project.streams
        }
      },
      {
        eventType: 'stream-project-removed',
        streamId: stream.streamId,
        streamJobNumber: stream.jobNumber,
        projects: {
          projectRemoved: project.id,
          projects: stream.projects
        }
      } ]
      let topic = process.env.KAFKA_TOPIC
      produceMsg( kafka, topic, eventData )
    }

    return res.send( { success: true, project: project, stream: stream } )
  } catch ( err ) {
    winston.error( err )
    res.status( err.message.indexOf( 'authorised' ) >= 0 ? 401 : 404 ).send( { success: false, message: err.message } )
  }
}
