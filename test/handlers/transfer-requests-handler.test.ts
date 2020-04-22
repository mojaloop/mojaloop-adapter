import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { TransfersIDPutResponse } from '../../src/types/mojaloop'
import { transferRequestHandler } from '../../src/handlers/transfer-request-handler'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
import { TransactionState, Transaction, TransferState, Transfers, LpsMessage, LegacyMessageType } from '../../src/models'
import { Model } from 'objection'
import { ResponseType } from '../../src/types/adaptor-relay-messages'
import { ISO0200Factory } from '../factories/iso-messages'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
const sdk = require('@mojaloop/sdk-standard-components')
Logger.log = Logger.info

describe('Transfer Requests Handler', () => {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
  const logger = Logger
  const ilp = new sdk.Ilp({ secret: 'test', logger })
  const services = AdaptorServicesFactory.build({ ilpService: ilp })
  const quoteRequest = QuotesPostRequestFactory.build({
    quoteId: uuid(),
    transactionRequestId: uuid(),
    transactionId: uuid(),
    amount: {
      amount: '100',
      currency: 'USD'
    }
  })
  const quoteResponse = {
    transferAmount: {
      amount: '107',
      currency: 'USD'
    },
    payeeFspFee: {
      amount: '7',
      currency: 'USD'
    }
  }
  const { ilpPacket, condition } = ilp.getQuoteResponseIlp(quoteRequest, quoteResponse)
  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: quoteRequest.transactionRequestId,
    transactionId: quoteRequest.transactionId,
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.financialRequestSent,
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
    },
    fees: [{
      type: 'lps',
      amount: '5',
      currency: 'USD'
    }, {
      type: 'adaptor',
      amount: '2',
      currency: 'USD'
    }],
    quote: {
      id: quoteRequest.quoteId,
      transactionId: quoteRequest.transactionId,
      transferAmount: '107',
      transferAmountCurrency: 'USD',
      amount: '100',
      amountCurrency: 'USD',
      feeAmount: '7',
      feeCurrency: 'USD',
      ilpPacket,
      condition,
      expiration: new Date(Date.now() + 10000).toUTCString()
    }
  }

  beforeAll(async () => {
    if (dbConfig === 'sqlite') {      
      await knex.migrate.latest()
    }
  })

  beforeEach(async () => {
    trx = await knex.transaction()
    Model.knex(trx)
  })

  afterEach(async () => {
    await trx.rollback()
    await trx.destroy()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('creates transfer', async () => {
    await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    const transfer = await Transfers.query().where({ id: transferRequest.transferId }).first()
    expect(transfer).toMatchObject({
      id: transferRequest.transferId,
      quoteId: quoteRequest.quoteId,
      transactionRequestId: quoteRequest.transactionRequestId,
      fulfillment: ilp.calculateFulfil(transferRequest.ilpPacket),
      state: TransferState.reserved,
      amount: transferRequest.amount.amount,
      currency: transferRequest.amount.currency
    })
  })

  test('sends transfer response and updates transaction state to fulfillmentSent', async () => {
    let transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    Date.now = jest.fn().mockReturnValue(0)
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket,
      payerFsp: 'payerFSP'
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    transaction = await transaction.$query()
    expect(transaction.state).toBe(TransactionState.fulfillmentSent)
    expect(transaction.previousState).toBe(TransactionState.financialRequestSent)
    const transferResponse: TransfersIDPutResponse = {
      fulfilment: ilp.calculateFulfil(transferRequest.ilpPacket),
      transferState: TransferState.committed,
      completedTimestamp: (new Date(Date.now())).toISOString()
    }
    expect(services.mojaClient.putTransfers).toHaveBeenCalledWith(transferRequest.transferId, transferResponse, 'payerFSP')
  })

  test('sends transfer error if fails to process transfer request', async () => {
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket: 'not a real packet',
      payerFsp: 'payerFSP',
      expiration: new Date(Date.now() + 10000).toUTCString()
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    expect(services.mojaClient.putTransfersError).toHaveBeenCalledWith(transferRequest.transferId, { errorCode: '2001', errorDescription: 'Failed to process transfer request.' }, 'payerFSP')
  })

  test('sends a 5105 transfer error response and queues an invalid transaction message to the LPS if the transaction is not valid', async () => {
    const legacyFinancialRequest = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.financialRequest, lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, content: ISO0200Factory.build() })
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, state: TransactionState.transactionCancelled })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyFinancialRequest)
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    expect(await transaction.$relatedQuery('transfer')).toBeUndefined()
    expect(services.mojaClient.putTransfers).not.toHaveBeenCalled()
    expect(services.mojaClient.putTransfersError).toHaveBeenCalledWith(transferRequest.transferId, { errorInformation: { errorCode: '5105', errorDescription: 'Transaction is no longer valid.' } }, headers['fspiop-source'])
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1FinancialResponses', { lpsFinancialRequestMessageId: legacyFinancialRequest.id, response: ResponseType.invalid })
  })

  test('sends a 3302 and queues an invalid transaction message if the quote has expired', async () => {
    const legacyFinancialRequest = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.financialRequest, lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, content: ISO0200Factory.build() })
    const { quote, ...transactionWithoutQuote } = transactionInfo
    quote.expiration = new Date(Date.now() - 1000).toUTCString()
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionWithoutQuote, expiration: new Date(Date.now() + 10000).toUTCString(), quote })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyFinancialRequest)
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    expect(services.mojaClient.putTransfers).not.toHaveBeenCalled()
    expect(services.mojaClient.putTransfersError).toHaveBeenCalledWith(transferRequest.transferId, { errorInformation: { errorCode: '3302', errorDescription: 'Quote has expired.' } }, headers['fspiop-source'])
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1FinancialResponses', { lpsFinancialRequestMessageId: legacyFinancialRequest.id, response: ResponseType.invalid })
  })

})
