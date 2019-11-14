import { createApp } from '../src/adaptor'
import { handleIsoMessage } from '../src/tcp-relay'
import { TransactionRequestService } from '../src/services/transaction-request-service'
import { AccountLookUpService } from '../src/services/account-lookup-service'
import { ISO0100Factory } from './factories/iso-messages'
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
    const iso0100Json = ISO0100Factory.build()
    iso0100Json[0] = '0100'
    const iso0100: Buffer = new IsoParser(iso0100Json).getBufferMessage()

    handleIsoMessage(iso0100, adaptor)

    expect(adaptor.inject).toHaveBeenCalledWith({
      method: 'POST',
      url: '/iso8583/transactionRequests',
      payload: iso0100Json
    })
  })
})
