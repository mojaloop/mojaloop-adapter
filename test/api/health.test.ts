import { TransactionRequestService } from '../../src/services/transaction-request-service'
import { AccountLookUpService } from '../../src/services/account-lookup-service'
import { createApp } from '../../src/adaptor'
import { Server } from 'hapi'

describe('Health endpoint', function () {

  const mockTransactionRequestService: TransactionRequestService = {
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn().mockImplementation((id: string, request: { [k: string]: any }) => {
      return { id, payer: { fspId: request.payer.fspId } }
    }),
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

  test('returns status ok', async () => {
    const response = await adaptor.inject({
      method: 'GET',
      url: '/health'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toBe(JSON.stringify({ status: 'ok' }))
  })

})
