import net from 'net'
import { Server } from 'hapi'
import { TcpIsoMessagingClient } from './services/iso-messaging-client'
const IsoParser = require('iso_8583')

export function handleIsoMessage (data: Buffer, adaptor: Server): void {
  const mti = data.slice(2, 6).toString()
  const isoMessage = new IsoParser().getIsoJSON(data)
  adaptor.app.logger.debug('Message mti: ' + mti)
  adaptor.app.logger.debug('Message converted to JSON: ' + JSON.stringify(isoMessage))
  switch (mti) {
    case '0100':
      adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: isoMessage
      })
      break
    default:
      adaptor.app.logger.error(`Cannot handle iso message of type: ${mti}`)
  }
}

export function createTcpRelay (adaptor: Server): net.Server {

  return net.createServer(function (sock) {

    adaptor.app.logger.info('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort)

    const isoMessagingClient = new TcpIsoMessagingClient(sock)

    adaptor.app.isoMessagingClient = isoMessagingClient

    sock.on('data', (data) => {
      try {
        adaptor.app.logger.debug('Received buffer message: ' + data.toString())
        handleIsoMessage(data, adaptor)
      } catch (error) {
        adaptor.app.logger.error('Failed to handle iso message. ' + error.toString())
      }
    })

  })

}
