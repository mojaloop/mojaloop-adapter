import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { TransfersIDPutResponse } from '../../src/types/mojaloop'
import { transferRequestHandler } from '../../src/handlers/transfer-request-handler'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
import { TransactionState, Transaction, TransferState, Transfers } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
const sdk = require('@mojaloop/sdk-standard-components')
Logger.log = Logger.info

describe('Transfer Requests Handler', () => {
  let knex: Knex
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

  test('creates transfer', async () => {
    await Transaction.query().insertGraphAndFetch(transactionInfo)
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
      fulfillment: ilp.caluclateFulfil(transferRequest.ilpPacket),
      state: TransferState.reserved,
      amount: transferRequest.amount.amount,
      currency: transferRequest.amount.currency
    })
  })

  test('sends transfer response and updates transaction state to fulfillmentSent', async () => {
    let transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
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
      fulfilment: ilp.caluclateFulfil(transferRequest.ilpPacket),
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
      payerFsp: 'payerFSP'
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    expect(services.mojaClient.putTransfersError).toHaveBeenCalledWith(transferRequest.transferId, { errorCode: '2001', errorDescription: 'Failed to process transfer request.' }, 'payerFSP')
  })
})
