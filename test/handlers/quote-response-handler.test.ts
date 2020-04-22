import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesIDPutResponse, TransfersPostRequest } from '../../src/types/mojaloop'
import { quoteResponseHandler } from '../../src/handlers/quote-response-handler'
import { Quote, Transfers, TransferState, TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Quote Response Handler', () => {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
  const services = AdaptorServicesFactory.build()

  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    transactionId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.transactionResponded,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP',
    payer: {
      type: 'payer',
      identifierType: 'MSISDN',
      identifierValue: '0821234567',
      fspId: 'mojawallet'
    },
    payee: {
      type: 'payee',
      identifierType: 'DEVICE',
      identifierValue: '1234',
      subIdOrType: 'abcd',
      fspId: 'adaptor'
    }
  }

  const quote = {
    id: uuid(),
    transactionRequestId: transactionInfo.transactionRequestId,
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
    if (dbConfig === 'sqlite') {      
      await knex.migrate.latest()
    }
  })

  beforeEach(async () => {
    trx = await knex.transaction()
    Model.knex(trx)
    await Transaction.query().insertGraph(transactionInfo)
  })

  afterEach(async () => {
    await trx.rollback()
    await trx.destroy()
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

  test('Calls services.ilpService.calculateFulfil to calculate the fulfilment from ilp-packet', async () => {
    await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    expect(services.ilpService.calculateFulfil).toBeCalledWith(quoteResponse.ilpPacket)
  })

  test('Create and store a transfer', async () => {
    services.ilpService.calculateFulfil = jest.fn().mockResolvedValueOnce('test-fulfillment')
    await Quote.query().insertGraphAndFetch(quote)
    await quoteResponseHandler(services, quoteResponse, quote.id, headers)
    const transfer = await Transfers.query().where('quoteId', quote.id).first()
    expect(transfer).toBeDefined()
    expect(transfer.state).toEqual(TransferState.reserved)
  })

  test('Calls services.mojaClient.postTransfers to send the transferRequest', async () => {
    services.ilpService.calculateFulfil = jest.fn().mockResolvedValueOnce('test-fulfillment')
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
