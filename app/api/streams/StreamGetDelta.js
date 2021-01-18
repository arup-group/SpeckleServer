const winston = require( '../../../config/logger' )
//const _ = require( 'lodash' )
const DataStream = require( '../../../models/DataStream' )
const Client = require( '../../../models/UserAppClient' )
const PermissionCheck = require( '../middleware/PermissionCheck' )

module.exports = ( req, res ) => {
  //console.log( req.params )
  if ( !req.params.streamId || !req.params.otherId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'No stream id provided.' } )
  }

  if ( req.params.streamId == req.params.otherId ) {
    res.status( 400 )
    return res.send( { success: false, message: 'Can not diff the same stream, yo!' } )
  }

  let first = {}
  let second = {}
  let firstClients = []
  let secondClients = []

  DataStream.find( { streamId: { $in: [ req.params.streamId, req.params.otherId ] } } ).lean( )
    .then( streams => {
      if ( streams.length != 2 ) throw new Error( 'Failed to find streams.' )

      first = streams.find( s => s.streamId === req.params.streamId )
      second = streams.find( s => s.streamId === req.params.otherId )


      // check if user can read first stream

      return PermissionCheck( req.user, 'read', first )
    } )
    .then( ( ) => {
      // check if user can read second stream
      return PermissionCheck( req.user, 'read', second )
    } )
    .then( ( ) => {
       return Client.find( { streamId: first.streamId } ).populate( 'owner', 'name surname email company' )
    } )
    .then( clFirst => {
      firstClients = clFirst
      return Client.find( { streamId: second.streamId } ).populate( 'owner', 'name surname email company' )
    } )
    .then( clSecond => {

      secondClients = clSecond

      let objects = { common: null, inA: null, inB: null }
      first.objects = first.objects.map( o => o.toString( ) )
      second.objects = second.objects.map( o => o.toString( ) )
      objects.common = first.objects.filter( id => second.objects.includes( id ) )
      objects.inA = first.objects.filter( id => !second.objects.includes( id ) )
      objects.inB = second.objects.filter( id => !first.objects.includes( id ) )
      let firstSenderClient = firstClients.filter( cl => cl.role === 'Sender' )[0] // returns an arr, take first elem

      let secondSenderClient = secondClients.filter( cl => cl.role === 'Sender' )[0] // returns an arr, take first elem

      if ( firstSenderClient == undefined && secondSenderClient == undefined ) {
        res.status( 400 )
        return res.send( {
          success: true,
          message: "Clients from Stream A and Stream B are undefined",
          revisionDatetime: new Date().toLocaleString( "en" ),
          author: "undefined",
          delta: {
            created: objects.inB.map( id =>  { return { type: "Placeholder", _id: id } } ),
            deleted: objects.inA.map( id =>  { return { type: "Placeholder", _id: id } } ),
            common: objects.common.map( id =>  { return { type: "Placeholder", _id: id } } ),
            revisionA: {
              id: req.params.streamId.toString(),
              updatedAt: "undefined",
              sender: "undefined"
            },
            revisionB: {
              id: req.params.otherId.toString(),
              updatedAt: "undefined",
              sender: "undefined"
            },
            timestamp: new Date().toLocaleString( "en" ),
          },

        } )
      }

      if ( firstSenderClient == undefined ) {
        res.status( 400 )
        return res.send( {
          success: true,
          message: "Clients from Stream A are undefined",
          revisionDatetime: new Date().toLocaleString( "en" ),
          author: "undefined",
          delta: {
            created: objects.inB.map( id =>  { return { type: "Placeholder", _id: id } } ),
            deleted: objects.inA.map( id =>  { return { type: "Placeholder", _id: id } } ),
            common: objects.common.map( id =>  { return { type: "Placeholder", _id: id } } ),
            revisionA: {
              id: req.params.streamId.toString(),
              updatedAt: "undefined",
              sender: "undefined"
            },
            revisionB: {
              id: req.params.otherId.toString(),
              updatedAt: secondSenderClient.updatedAt.toLocaleString( "en" ),
              sender: secondSenderClient.documentType.toString()
            },
            timestamp: new Date().toLocaleString( "en" ),
          },

        } )
      }

      if ( secondSenderClient == undefined ) {
        res.status( 400 )
        return res.send( {
          success: true,
          message: "Clients from Stream B are undefined",
          revisionDatetime: new Date().toLocaleString( "en" ),
          author: firstSenderClient.owner,
          delta: {
            created: objects.inB.map( id =>  { return { type: "Placeholder", _id: id } } ),
            deleted: objects.inA.map( id =>  { return { type: "Placeholder", _id: id } } ),
            common: objects.common.map( id =>  { return { type: "Placeholder", _id: id } } ),
            revisionA: {
              id: req.params.streamId.toString(),
              updatedAt: firstSenderClient.updatedAt.toLocaleString( "en" ),
              sender: firstSenderClient.documentType.toString()
            },
            revisionB: {
              id: req.params.otherId.toString(),
              updatedAt: "undefined",
              sender: "undefined"
            },
            timestamp: new Date().toLocaleString( "en" ),
          },

        } )
      }

      res.send( {
        success: true,
        revisionDatetime: new Date().toLocaleString( "en" ),
        author: firstSenderClient.owner,
        delta: {
          created: objects.inB.map( id =>  { return { type: "Placeholder", _id: id } } ),
          deleted: objects.inA.map( id =>  { return { type: "Placeholder", _id: id } } ),
          common: objects.common.map( id =>  { return { type: "Placeholder", _id: id } } ),
          revisionA: {
            id: req.params.streamId.toString(),
            updatedAt: firstSenderClient.updatedAt.toLocaleString( "en" ),
            sender: firstSenderClient.documentType.toString()
          },
          revisionB: {
            id: req.params.otherId.toString(),
            updatedAt: secondSenderClient.updatedAt.toLocaleString( "en" ),
            sender: secondSenderClient.documentType.toString()
          },
          timestamp: new Date().toLocaleString( "en" ),
        },

      } )

    } )
    .catch( err => {
      winston.error( err )
      res.status( 400 )
      res.send( { success: false, message: err.toString( )} )
    } )

}