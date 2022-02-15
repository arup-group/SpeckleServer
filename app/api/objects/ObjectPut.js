const winston = require( '../../../config/logger' )
const mongoose = require( 'mongoose' )

const SpeckleObject = require( '../../../models/SpeckleObject' )
const DataStream = require( '../../../models/DataStream' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = ( req, res ) => {
  if ( !req.params.objectId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'Malformed request.' } )
  }

  // derive permissions for editing an object from the permissions of the associated (containing) streams
  // ie. if you can write to the stream, you can update the object contained in the stream
  DataStream.find( { objects: mongoose.Types.ObjectId( req.params.objectId ) }, 'canWrite canRead streamId owner' )
    .then( streams => Promise.all( streams.map( s => PermissionCheck( req.user, 'write', s ) ) )
      .then( () => {
        return SpeckleObject.findOne( { _id: req.params.objectId } )
      } )
      .then( result => result.set( req.body ).save() )
      .then( () => {
        res.send( { success: true, message: 'Object updated.' } )
      } )
      .catch( err => {
        winston.error( err )
        res.status( 400 )
        return res.send( { success: false, message: err.toString() } )
      } )
    )
}
