import net from 'net'
import { Server } from 'hapi'
import { TcpIsoMessagingClient } from 'services/iso-messaging-client'
const IsoParser = require('iso_8583')

export function handleIsoMessage (data: Buffer, adaptor: Server): void {
  const mti = data.slice(2, 6).toString()
  const isoMessage = new IsoParser().getIsoJSON(data)

  switch (mti) {
    case '0100':
      adaptor.inject({
        method: 'POST',
        url: '/transactionRequests',
        payload: isoMessage
      })
      break
    default:
      adaptor.app.logger.error(`Cannot handle iso message of type: ${mti}`)
  }
}

export function createTcpRelay (adaptor: Server): net.Server {

  return net.createServer(function (sock) {

    const isoMessagingClient = new TcpIsoMessagingClient(sock)

    adaptor.app.isoMessagingClient = isoMessagingClient

    sock.on('data', (data) => {
      handleIsoMessage(data, adaptor)
    })

  })

}
