import { createApp } from '../src/adaptor'
import { handleIsoMessage } from '../src/tcp-relay'
import { iso0100BinaryMessage } from './factories/iso-messages'
import { Server } from 'hapi'
import { AdaptorServicesFactory } from './factories/adaptor-services'

const IsoParser = require('iso_8583')

describe('TCP relay', function () {

  const services = AdaptorServicesFactory.build()

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp(services)
    adaptor.inject = jest.fn()
  })

  test('maps 0100 message to the transactionRequests endpoint', async () => {
    const iso0100 = iso0100BinaryMessage
    const isoMessage = new IsoParser().getIsoJSON(iso0100)

    handleIsoMessage(iso0100, adaptor)

    expect(adaptor.inject).toHaveBeenCalledWith({
      method: 'POST',
      url: '/transactionRequests',
      payload: isoMessage
    })
  })
})
