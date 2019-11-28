import net from 'net'
import { Server, ServerInjectResponse } from 'hapi'
import { TcpIsoMessagingClient } from './services/iso-messaging-client'
const IsoParser = require('iso_8583')

export async function handleIsoMessage (lpsKey: string, data: Buffer, adaptor: Server): Promise <void> {
  const mti = data.slice(2, 6).toString()
  const isoMessage = new IsoParser().getIsoJSON(data)
  adaptor.app.logger.debug('TCPRelay: Message mti: ' + mti)
  adaptor.app.logger.debug('TCPRelay: Message converted to JSON: ' + JSON.stringify(isoMessage))
  let response: ServerInjectResponse
  switch (mti) {
    case '0100':
      adaptor.app.logger.debug(`${lpsKey} relay: Handling 0100 message...`)
      response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: { switchKey: isoMessage['127.2'], lpsKey, ...isoMessage }
      })

      if (response.statusCode !== 200) {
        throw new Error(response.statusMessage)
      }
      adaptor.app.logger.debug(`${lpsKey} relay: Finished handling 0100 message...`)
      break
    default:
      adaptor.app.logger.error(`${lpsKey} relay: Cannot handle iso message of type: ${mti}`)
  }
}

export function createTcpRelay (lpsKey: string, adaptor: Server): net.Server {

  return net.createServer(function (sock) {

    adaptor.app.logger.info(lpsKey + ' CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort)

    const isoMessagingClient = new TcpIsoMessagingClient(sock)

    adaptor.app.isoMessagingClients.set(lpsKey, isoMessagingClient)
    
    sock.on('data', async (data) => {
      try {
        adaptor.app.logger.debug(`${lpsKey} relay: Received buffer message: ` + data)
        await handleIsoMessage(lpsKey, data, adaptor)
      } catch (error) {
        adaptor.app.logger.error(`${lpsKey} relay: Failed to handle iso message.`)
        adaptor.app.logger.error(error)
      }
    })

  })

}
