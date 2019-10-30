import { createApp } from '../../src/adaptor'
import { TransactionRequestService } from '../../src/services/transaction-request-service'
import { AccountLookUpService } from '../../src/services/account-lookup-service'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'

describe('Parties API', function () {

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
  const adaptor = createApp({
    transactionRequestService: mockTransactionRequestService,
    accountLookupService: mockAccountLookupService
  }, {})

  test('updates the fspId of the payer in the transaction request', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    expect(mockTransactionRequestService.update).toHaveBeenCalledWith('123', { payer: { fspId: putPartiesResponse.party.partyIdInfo.fspId } })
  })

  test('makes a transaction request to the Moja switch', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build()

    const response = await adaptor.inject({
      method: 'PUT',
      headers: { ID: '123' },
      payload: putPartiesResponse,
      url: `/parties/MSISDN/${putPartiesResponse.party.partyIdInfo.partyIdentifier}`
    })

    expect(response.statusCode).toBe(200)
    expect(mockTransactionRequestService.sendToMojaHub).toHaveBeenCalledWith({ id: '123', payer: { fspId: putPartiesResponse.party.partyIdInfo.fspId } })
  })
})
