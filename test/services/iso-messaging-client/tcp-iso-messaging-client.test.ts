import { Socket } from 'net'
import { TcpIsoMessagingClient } from '../../../src/services/iso-messaging-client'
import { ISO0100Factory } from '../../factories/iso-messages'
const IsoParser = require('iso_8583')

describe('TCP Iso Messaging Client', function () {
  const sock = new Socket()
  sock.write = jest.fn()
  const tcpIsoMessagingClient = new TcpIsoMessagingClient(sock)

  describe('sendAuthorizationRequest', () => {
    test('converts message to buffer and sends over socket', async () => {
      const isoJsonMessage = ISO0100Factory.build()
      isoJsonMessage[0] = '0100'
      await tcpIsoMessagingClient.sendAuthorizationRequest(isoJsonMessage)

      const expectedBuffer = new IsoParser(isoJsonMessage).getBufferMessage()
      expect(expectedBuffer).toBeInstanceOf(Object)
      expect(sock.write).toHaveBeenCalledWith(expectedBuffer)
    })
  })

  test('send throws an error if there no socket registered', async () => {
    const noSocketClient = new TcpIsoMessagingClient()
    await expect(() => { noSocketClient.send(Buffer.alloc(0)) }).toThrowError('Cannot send ISO message. No socket registered.')
  })

})
