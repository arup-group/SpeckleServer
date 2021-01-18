const winston = require( '../../../config/logger' )

const Project = require( '../../../models/Project' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = ( req, res ) => {
  if ( !req.params.projectId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'No projectId provided' } )
  }

  let project = {}
  let canWrite = {}

  Project.findOne( { _id: req.params.projectId } )
    .then( resource => PermissionCheck( req.user, 'write', resource ) )
    .then( resource => {
      project = resource
      canWrite = project.canWrite
      resource.canRead = resource.canRead.filter( x => !!x )
      resource.canWrite = resource.canWrite.filter( x => !!x )
      return resource.set( req.body ).save( )
    } )
    .then( ( ) => {
      res.send( { success: true, message: `Patched ${Object.keys( req.body )} for ${req.params.projectId}.` } )
    } )
    .then( ( ) => {
      if ( process.env.USE_KAFKA === 'true' ){
        let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
        let topic = process.env.KAFKA_TOPIC
        let eventData = [ {
          eventType: 'project-updated',
          projectId: project.id,
          projectJobNumber: project.jobNumber,
          streams: project.streams
        } ]
        if ( req.body.permissions ){
          if ( req.body.canWrite.length < canWrite.length ){
            eventData[0].eventType = 'project-user-downgraded'
            produceMsg( kafka, topic, eventData )
          }
        } else
            produceMsg( kafka, topic, eventData )
      }
    } )
    .catch( err => {
      winston.error( err )
      res.status( err.message.indexOf( 'authorised' ) >= 0 ? 401 : 404 )
      res.send( { success: false, message: err.message } )
    } )
}
