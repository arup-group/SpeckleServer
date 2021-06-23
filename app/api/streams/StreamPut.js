const winston = require( '../../../config/logger' )
const chalk = require( 'chalk' )

const DataStream = require( '../../../models/DataStream' )
const PermissionCheck = require( '../middleware/PermissionCheck' )
const BulkObjectSave = require( '../middleware/BulkObjectSave' )

module.exports = ( req, res ) => {
  winston.debug( chalk.bgGreen( 'Patching stream', req.params.streamId ) )

  if ( !req.params.streamId || !req.body ) {
    return res.status( 400 ).send( { success: false, message: 'No streamId or stream provided.' } )
  }

  // prevent streamId changes
  if ( Object.keys( req.body ).indexOf( 'streamId' ) )
    delete req.body.streamId

  let stream = {}
  let objsToSave = [ ]
  let usersChange = req.body.canRead || req.body.canWrite ? true : false
  let ownerUser, readUsersOld, writeUsersOld, usersCurrent
  let readUsersOldCount, writeUsersOldCount

  if ( req.body.objects )
    objsToSave = req.body.objects.filter( o => o.type !== 'Placeholder' )

  DataStream.findOne( { streamId: req.params.streamId } )
    .then( result => PermissionCheck( req.user, 'write', result, Object.keys( req.body ) ) )
    .then( result => {
      stream = result
      return objsToSave.length > 0 ? BulkObjectSave( objsToSave, req.user ) : true
    } )
    .then( result => {
      if ( process.env.USE_KAFKA === 'true' ){
        if ( usersChange ){
          ownerUser = new Set( [ stream.owner.toString() ] )
          readUsersOld = new Set( stream.canRead.map( x => x.toString() ) )
          writeUsersOld = new Set( stream.canWrite.map( x => x.toString() ) )
          usersCurrent = new Set( [ ...ownerUser, ...readUsersOld, ...writeUsersOld ] )

          readUsersOldCount = readUsersOld.size
          writeUsersOldCount = writeUsersOld.size
        }
      }

      stream.set( req.body )
      if ( objsToSave.length > 0 ) stream.objects = result.map( obj => obj._id )

      stream.canRead = stream.canRead.filter( x => !!x )
      stream.canWrite = stream.canWrite.filter( x => !!x )

      return stream.save( )
    } )
    .then( ( ) => {
      res.send( { success: true, message: 'Patched stream fields: ' + Object.keys( req.body ) } )
    } )
    .then( ( ) => {
      if ( process.env.USE_KAFKA === 'true' ){
        let { kafka, produceMsg } = require( '../../../config/kafkaHelper' )
        let topic = process.env.KAFKA_TOPIC

        let readUsersNew = new Set( stream.canRead.map( x => x.toString() ) )
        let writeUsersNew = new Set( stream.canWrite.map( x => x.toString() ) )
        ownerUser = new Set( [ stream.owner.toString() ] )
        let usersNew = new Set( [ ...ownerUser, ...readUsersNew, ...writeUsersNew ] )

        let eventData = {
          eventType: 'stream-updated',
          streamId: stream.streamId,
          streamJobNumber: stream.jobNumber,
          fieldsPatched: Object.keys( req.body )
        }

        if ( usersChange ){
          let diffReadWrite = new Set( [ ...usersCurrent ].filter( user => !usersNew.has( user ) ) )
          let diffWriteRead =  new Set( [ ...usersNew ].filter( user => !usersCurrent.has( user ) ) )
          let usersDiff = new Set( [ ...diffReadWrite, ...diffWriteRead ] )
          let readUsersNewCount = readUsersNew.size
          let writeUsersNewCount = writeUsersNew.size
          let usersDiffCount = usersDiff.size

          let usersData = {
            owner: stream.owner,
            canRead: Array.from( readUsersNew ),
            canWrite: Array.from( writeUsersNew )
          }

          if ( usersDiffCount > 0 ) {
            if ( readUsersNewCount > readUsersOldCount || writeUsersNewCount > writeUsersOldCount ){
              eventData.eventType = 'stream-user-added'
              usersData.userAdded = [ ...usersDiff ].join( '' )
              eventData.users =  usersData
            }
            else if ( readUsersNewCount < readUsersOldCount || writeUsersNewCount < writeUsersOldCount ){
              eventData.eventType = 'stream-user-removed'
              usersData.userRemoved = [ ...usersDiff ].join( '' )
              eventData.users = usersData
            }
          } else if ( readUsersNewCount > readUsersOldCount ){
              eventData.eventType = 'stream-user-downgraded'
              let userDowngraded = new Set( [ ...readUsersNew ].filter( user => !readUsersOld.has( user ) ) )
              usersData.userDowngraded = [ ...userDowngraded ].join( '' )
              eventData.users =  usersData
          } else if ( writeUsersNewCount > writeUsersOldCount ) {
              eventData.eventType = 'stream-user-upgraded'
              let usersUpgraded = new Set( [ ...writeUsersNew ].filter( user => !writeUsersOld.has( user ) ) )
              usersData.userUpgraded = [ ...usersUpgraded ].join( '' )
              eventData.users =  usersData
          }
        }
        produceMsg( kafka, topic, [ eventData ] )
      }
    } )
    .catch( err => {
      winston.error( err )
      res.status( 400 )
      res.send( { success: false, message: err.toString( ) } )
    } )
}
