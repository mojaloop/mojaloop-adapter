import { createApp } from '../src/adaptor'
import { handleIsoMessage } from '../src/tcp-relay'
import { TransactionRequestService } from '../src/services/transaction-request-service'
import { AccountLookUpService } from '../src/services/account-lookup-service'
import { ISO0100Factory } from './factories/iso-messages'
import { Server } from 'hapi'
const IsoParser = require('iso_8583')

describe('TCP relay', function () {

  const mockTransactionRequestService: TransactionRequestService = {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    sendToMojaHub: jest.fn()
  }

  const mockAccountLookupService: AccountLookUpService = {
    requestFspIdFromMsisdn: jest.fn().mockResolvedValue(undefined)
  }

  let adaptor: Server
  beforeAll(async () => {
    adaptor = await createApp({
      transactionRequestService: mockTransactionRequestService,
      accountLookupService: mockAccountLookupService
    })
    adaptor.inject = jest.fn()
  })

  test('maps 0100 message to the transactionRequests endpoint', async () => {
    const iso0100Json = ISO0100Factory.build()
    iso0100Json[0] = '0100'
    const iso0100: Buffer = new IsoParser(iso0100Json).getBufferMessage()

    handleIsoMessage(iso0100, adaptor)

    expect(adaptor.inject).toHaveBeenCalledWith({
      method: 'POST',
      url: '/transactionRequests',
      payload: iso0100Json
    })
  })
})
