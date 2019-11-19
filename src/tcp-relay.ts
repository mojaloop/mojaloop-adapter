import net from 'net'
import { Server, ServerInjectResponse } from 'hapi'
import { TcpIsoMessagingClient } from './services/iso-messaging-client'
const IsoParser = require('iso_8583')

export async function handleIsoMessage (data: Buffer, adaptor: Server): Promise<void> {
  const mti = data.slice(2, 6).toString()
  const isoMessage = new IsoParser().getIsoJSON(data)
  adaptor.app.logger.debug('TCPRelay: Message mti: ' + mti)
  adaptor.app.logger.debug('TCPRelay: Message converted to JSON: ' + JSON.stringify(isoMessage))
  let response: ServerInjectResponse
  switch (mti) {
    case '0100':
      adaptor.app.logger.debug('TCPRelay: Handling 0100 message...')
      response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: isoMessage
      })

      if (response.statusCode !== 200) {
        throw new Error(response.statusMessage)
      }
      adaptor.app.logger.debug('TCPRelay: Finished handling 0100 message...')
      break
    default:
      adaptor.app.logger.error(`TCPRelay: Cannot handle iso message of type: ${mti}`)
  }
}

export function createTcpRelay (adaptor: Server): net.Server {

  return net.createServer(function (sock) {

    adaptor.app.logger.info('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort)

    const isoMessagingClient = new TcpIsoMessagingClient(sock)

    adaptor.app.isoMessagingClient = isoMessagingClient

    sock.on('data', async (data) => {
      try {
        adaptor.app.logger.debug('TCPRelay: Received buffer message: ' + data)
        await handleIsoMessage(data, adaptor)
      } catch (error) {
        adaptor.app.logger.error('TCPRelay: Failed to handle iso message. ')
        adaptor.app.logger.error(error)
      }
    })

  })

}
