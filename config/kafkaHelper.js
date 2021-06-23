'use strict'
const winston = require( './logger' )
const { Kafka, logLevel } = require( 'kafkajs' )

const initialKafkaClient = () => {
  const kafkaInit = new Kafka( {
    clientId: process.env.SERVER_NAME,
    brokers: process.env.KAFKA_BROKERS.split( ',' ).map( s => s.trim() ),
    authenticationTimeout: 30000,
    reauthenticationThreshold: 10000,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    retry: {
      initialRetryTime: 100,
      maxRetryTime: 30000,
      retries: 200,
    },
    logLevel: logLevel.ERROR,
    ssl: true,
    sasl: {
      mechanism: 'plain', // scram-sha-256 or scram-sha-512
      username: process.env.KAFKA_API_KEY,
      password: process.env.KAFKA_API_SECRET
    },
  } );
  return kafkaInit;
}

const newMessage = ( topicName, eventData ) => {
  let keyResource = '', keyId = ''
  let serverName = process.env.SERVER_NAME
  let messageValues = [ ]
  for ( let singleEvent in eventData ) {
    if ( eventData[singleEvent].eventType.startsWith( 'stream' ) ){
      keyResource = 'stream'
      keyId = eventData[singleEvent].streamId
    }
    else if ( eventData[singleEvent].eventType.startsWith( 'project' ) ){
      keyResource = 'project'
      keyId = eventData[singleEvent].projectId
    } // TODO: add other resources
    let time = Date.now()
    let sourceTimestamp = new Date( time ).toISOString();
    let message = {
      key: `${serverName}-${keyResource}-${keyId}`,
      value: JSON.stringify( eventData[singleEvent] ),
      headers: {
          'id': `${time}`,
          'speckleTime': `${sourceTimestamp}`
      }
    }
    messageValues.push( message )
  }
  const messages = {
    topic: topicName,
    messages: messageValues
  }
  return messages;
}

const kafka = initialKafkaClient()

const produceMsg = async ( kafkaClient, topicName, eventData ) => {
  let messages = newMessage( topicName, eventData )
  try {
    const producer = kafka.producer()
    await producer.connect()
    await producer.send( messages )
    producer.disconnect()
    winston.debug( `${messages.messages.length} message(s) sent to Kafka...`  )
  } catch ( err ) {
    winston.error( err )
  }
}

module.exports = {
  kafka,
  newMessage,
  produceMsg
}
