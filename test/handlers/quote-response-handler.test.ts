import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesIDPutResponse, TransfersPostRequest } from '../../src/types/mojaloop'
import { quoteResponseHandler } from '../../src/handlers/quote-response-handler'
import { Quote, Transfers, TransferState } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')

describe('Legacy Reversal Handler', () => {
  let knex: Knex
  const services = AdaptorServicesFactory.build()

  const quote = {
    id: uuid(),
    transactionRequestId: uuid(),
    transferAmount: '107',
    transferAmountCurrency: 'USD',
    amount: '100',
    amountCurrency: 'USD',
    feeAmount: '7',
    feeCurrency: 'USD',
    ilpPacket: 'test-packet',
    condition: 'test-condition',
    expiration: new Date(Date.now()).toUTCString()
  }

  const quoteResponse: QuotesIDPutResponse = {
    transferAmount: {
      amount: '108',
      currency: 'USD'
    },
    expiration: new Date(Date.now() + 10000).toUTCString(),
    ilpPacket: 'test-packet-returned',
    condition: 'test-condition-returned'
  }

  const headers = {
    'fspiop-source': 'payee',
    'fspiop-destination': 'payer'
  }

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
    Model.knex(knex)
  })

  beforeEach(async () => {
    await knex.migrate.latest()
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('Find and update the quote with the information given in the quote response', async () => {
    const originalQuote = await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    const updatedQuote = await Quote.query().where('id', quote.id).first()
    expect(updatedQuote.transferAmount === originalQuote.transferAmount).toBeFalsy()
    expect(updatedQuote.condition === originalQuote.condition).toBeFalsy()
    expect(updatedQuote.ilpPacket === originalQuote.ilpPacket).toBeFalsy()
    expect(updatedQuote.expiration === originalQuote.expiration).toBeFalsy()
  })

  test('Calls services.ilpService.caluclateFulfil to calculate the fulfilment from ilp-packet', async () => {
    await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    expect(services.ilpService.caluclateFulfil).toBeCalledWith(quoteResponse.ilpPacket)
  })

  test('Create and store a transfer', async () => {
    services.ilpService.caluclateFulfil = jest.fn().mockResolvedValueOnce('test-fulfillment')
    await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    const transfer = await Transfers.query().where('quoteId', quote.id).first()
    expect(transfer).toBeDefined()
    expect(transfer.state).toEqual(TransferState.reserved)
  })

  test('Calls services.mojaClient.postTransfers to send the transferRequest', async () => {
    services.ilpService.caluclateFulfil = jest.fn().mockResolvedValueOnce('test-fulfillment')
    await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    const transfer = await Transfers.query().where('quoteId', quote.id).first()
    const transfersPostRequest: TransfersPostRequest = {
      transferId: transfer.id,
      payeeFsp: headers['fspiop-source'],
      payerFsp: headers['fspiop-destination'],
      amount: quoteResponse.transferAmount,
      ilpPacket: quoteResponse.ilpPacket,
      condition: quoteResponse.condition,
      expiration: quoteResponse.expiration
    }
    expect(services.mojaClient.postTransfers).toBeCalledWith(transfersPostRequest, headers['fspiop-source'])
  })

})
