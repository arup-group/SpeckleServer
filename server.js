'use strict'
const express             = require('express')
const cors                = require('cors')
const cookieParser        = require('cookie-parser')
const bodyParser          = require('body-parser')
const passport            = require('passport')
const path                = require('path')
const chalk               = require('chalk')
const winston             = require('winston')
const expressWinston      = require('express-winston')


const mongoose            = require('mongoose')
// const bluebird            = require('bluebird')

const CONFIG              = require('./config')

winston.level = 'debug'

////////////////////////////////////////////////////////////////////////
/// Mongo handlers                                                /////.
////////////////////////////////////////////////////////////////////////
mongoose.Promise = global.Promise
mongoose.connect( CONFIG.mongo.url, { auto_reconnect: true }, ( err ) => {
  if( err ) throw err
  else winston.info('connected to mongoose at ' + CONFIG.mongo.url )
})

mongoose.connection.on( 'error', err => {
  winston.debug( 'Failed to connect to DB ' + CONFIG.mongo + ' on startup ', err )
});

// When the connection is disconnected
mongoose.connection.on('disconnected', () => {
  winston.debug( 'Mongoose default was disconnected' )
});

mongoose.connection.on( 'connected', ref => {
  winston.debug( chalk.red( 'Connected to mongo.' ) )
})

////////////////////////////////////////////////////////////////////////
/// Various Express inits                                         /////.
////////////////////////////////////////////////////////////////////////
var app = express()
app.use( cors() ) // allow cors

app.use( expressWinston.logger( {
  transports: [ new winston.transports.Console( { json: false, colorize: true, timestamp: true } ) ],
  meta: false,
  msg: 'HTTP {{req.method}} {{req.url}} {{res.statusCode}} '
} ))

app.use( cookieParser() )
app.use( bodyParser.json( { limit: '50mb' } ) )
app.use( bodyParser.urlencoded( { limit: '50mb', extended: true } ) )
app.use( passport.initialize() )
require('./.config/passport' ) ( passport )

////////////////////////////////////////////////////////////////////////
/// Websockets & HTTP Servers                                     /////.
////////////////////////////////////////////////////////////////////////
var http = require('http')
var server = http.createServer( app )
var WebSocketServer = require('ws').Server

var wss = new WebSocketServer( {
  server: server,
  // verifyClient: require('./app/ws/middleware/VerifyClient')
} )

require('./app/ws/SpeckleSockets') ( wss )

app.get('/', function(req, res) {
  res.send( CONFIG.serverDescription )
})

////////////////////////////////////////////////////////////////////////
/// Temp Routes(debug)                                            /////.
////////////////////////////////////////////////////////////////////////

const RT = require('./app/ws/RadioTower')
const CS = require('./app/ws/ClientStore')

app.get('/stats', ( req, res ) => {
  res.json( { numclients: CS.clients.length, rooms: RT.getRooms() } )
} )

////////////////////////////////////////////////////////////////////////
/// Routes                                                        /////.
////////////////////////////////////////////////////////////////////////

require( './app/api/root' ) ( app, express )

////////////////////////////////////////////////////////////////////////
/// LAUNCH                                                         /////.
////////////////////////////////////////////////////////////////////////

server.listen( CONFIG.server.port, () => {
  winston.info( chalk.bgBlue( '>>>>>>>> Starting up @ ' + CONFIG.server.port + ' <<<<<<<<<<<') )
})