import { ISO0100Factory } from '../factories/iso-messages'
import { TransactionRequestService } from '../../src/services/transaction-request-service'
import { AccountLookUpService } from '../../src/services/account-lookup-service'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'

describe('Transaction Requests API', function () {

  // TODO: swap out for knexTransactionService once it's complete
  const mockTransactionRequestService: TransactionRequestService = {
    getById: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: '123' }),
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
  })

  test('creates a transaction request from the ISO0100 message', async () => {
    const iso0100 = ISO0100Factory.build()

    const response = await adaptor.inject({
      method: 'POST',
      url: '/transactionRequests',
      payload: iso0100
    })

    expect(response.statusCode).toEqual(200)
    expect(mockTransactionRequestService.create).toBeCalledWith({
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: iso0100[102]
      },
      payee: {
        partyIdInfo: {
          partyIdType: 'DEVICE',
          partyIdentifier: iso0100[41],
          partySubIdOrType: iso0100[42]
        }
      },
      amount: {
        amount: iso0100[4],
        currency: iso0100[49]
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: iso0100[7]
    })
  })

  test('Requests an account lookup and uses the transactionRequestId as the traceId', async () => {
    const iso0100 = ISO0100Factory.build()

    const response = await adaptor.inject({
      method: 'POST',
      url: '/transactionRequests',
      payload: iso0100
    })

    expect(response.statusCode).toEqual(200)
    expect(mockAccountLookupService.requestFspIdFromMsisdn).toHaveBeenCalledWith('123', iso0100[102])
  })

})
