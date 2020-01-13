import net from 'net'
import { Server, ServerInjectResponse } from 'hapi'
import { TcpIsoMessagingClient } from './services/iso-messaging-client'
const IsoParser = require('iso_8583')

export async function handleIsoMessage (lpsId: string, data: Buffer, adaptor: Server): Promise <void> {
  const mti = data.slice(2, 6).toString()
  const isoMessage = new IsoParser().getIsoJSON(data)
  const lpsKey: string = lpsId + '-' + isoMessage[41] + '-' + isoMessage[42]
  adaptor.app.logger.debug('TCPRelay: Message mti: ' + mti)
  adaptor.app.logger.debug('TCPRelay: Message converted to JSON: ' + JSON.stringify(isoMessage))
  let response: ServerInjectResponse
  switch (mti) {
    case '0100':
      adaptor.app.logger.debug(`${lpsId} relay: Handling 0100 message...`)
      response = await adaptor.inject({
        method: 'POST',
        url: '/iso8583/transactionRequests',
        payload: { lpsKey: lpsKey, lpsId, ...isoMessage }
      })
      if (response.statusCode !== 202) {
        throw new Error(response.statusMessage)
      }
      adaptor.app.logger.debug(`${lpsId} relay: Finished handling 0100 message...`)
      break
    case '0200':
      adaptor.app.logger.debug(`${lpsId} relay: Handling 0200 message...`)
      response = await adaptor.inject({
        method: 'PUT',
        url: `/iso8583/authorizations/${lpsKey}`,
        payload: { lpsKey: lpsKey, lpsId, ...isoMessage }
      })
      if (response.statusCode !== 200) {
        throw new Error(response.statusMessage)
      }
      adaptor.app.logger.debug(`${lpsId} relay: Finished handling 0200 message...`)
      break
    default:
      adaptor.app.logger.error(`${lpsId} relay: Cannot handle iso message of type: ${mti}`)
  }
}

export function createTcpRelay (lpsId: string, adaptor: Server): net.Server {

  return net.createServer(function (sock) {

    adaptor.app.logger.info(lpsId + ' CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort)

    const isoMessagingClient = new TcpIsoMessagingClient(sock)

    adaptor.app.isoMessagingClients.set(lpsId, isoMessagingClient)
    sock.on('data', async (data) => {
      try {
        adaptor.app.logger.debug(`${lpsId} relay: Received buffer message: ` + data)
        await handleIsoMessage(lpsId, data, adaptor)
      } catch (error) {
        adaptor.app.logger.error(`${lpsId} relay: Failed to handle iso message.`)
        adaptor.app.logger.error(error)
      }
    })

  })

}
