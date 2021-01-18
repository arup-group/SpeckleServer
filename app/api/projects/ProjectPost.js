const winston = require( '../../../config/logger' )

const Project = require( '../../../models/Project' )
const DataStream = require( '../../../models/DataStream' )

module.exports = async ( req, res ) => {
  if ( !req.body ) {
    res.status( 400 )
    return res.send( { success: false, message: 'No project provided' } )
  }

  try {
    let project = new Project( req.body )
    project.owner = req.user._id

    let streams = await DataStream.find( { streamId: { $in: req.body.streams } }, 'canWrite canRead streamId owner name projects' )
    let streamEventData = [ ]
    if ( streams.length > 0 ) {
      for ( let streamId of project.streams ) {
        let stream = streams.find( s => s.streamId === streamId )
        stream.projects.indexOf( project.id ) === -1 ? stream.projects.push( project.id ) : null
        if ( process.env.USE_KAFKA === 'true' ) {
          let eventData = {
            eventType: "stream-project-added",
            streamId: stream.streamId,
            streamJobNumber: stream.jobNumber,
            projects: {
              addedProject: project.id,
              projects: stream.projects
            }
          }
          streamEventData.push( eventData )
        }
      }
    }
    await Promise.all( [ project.save( ), ...streams.map( s => s.save( ) ) ] )
    if ( process.env.USE_KAFKA === 'true' ){
      let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
      let topic = process.env.KAFKA_TOPIC
      let projectEventData = [ {
        eventType: 'project-created',
        projectId: project.id,
        projectJobNumber: project.jobNumber,
        streams: project.streams,
        users: {
          owner: project.owner,
          canRead: project.canRead,
          canWrite: project.canWrite
        }
      } ]
      var events = streamEventData.concat( projectEventData )
      produceMsg( kafka, topic, events )
    }

    return res.send( { success: true, project: project, streams: streams } )
  } catch ( err ) {
    winston.error( err )
    res.status( 400 )
    return res.send( { success: false, message: err.toString() } )
  }
}