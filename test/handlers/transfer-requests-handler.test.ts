import Knex from 'knex'
import Axios, { AxiosInstance } from 'axios'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { Money, TransactionRequestsIDPutResponse, TransfersIDPutResponse } from '../../src/types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { quotesRequestHandler } from '../../src/handlers/quotes-handler'
import { authorizationRequestHandler } from '../../src/handlers/authorization-request-handler'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { legacyFinancialRequestHandler } from '../../src/handlers/legacy-financial-request-handler'
import { transferRequestHandler } from '../../src/handlers/transfer-request-handler'
import { LegacyFinancialRequest } from '../../src/types/adaptor-relay-messages'
import { TransferState, KnexTransfersService } from '../../src/services/transfers-service'
import { TransferPostRequestFactory } from '../factories/transfer-post-request'
const Logger = require('@mojaloop/central-services-logger')
const sdk = require('@mojaloop/sdk-standard-components')

describe('Transfer Requests Handler', () => {
  let knex: Knex
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const services = AdaptorServicesFactory.build()
  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })
  const logger = Logger
  let transferRequestIlpPacket: string

  beforeAll(async () => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
    services.transactionsService = new KnexTransactionsService({ knex, client: fakeHttpClient, logger })
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
    services.transfersService = new KnexTransfersService({ knex, ilpSecret: 'secret', logger })
    services.quotesService = new KnexQuotesService({ knex, ilpSecret: 'secret', logger, calculateAdaptorFees })
  })

  beforeEach(async () => {
    await knex.migrate.latest()

    const headers = {
      'fspiop-destination': 'payeeFSP',
      'fspiop-source': 'payerFSP'
    }
    const transactionRequest = TransactionRequestFactory.build({
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      transactionRequestId: '123',
      amount: {
        amount: '100',
        currency: 'USD'
      },
      lpsFee: {
        amount: '5',
        currency: 'USD'
      },
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '0821234567',
        fspId: 'payerFSP'
      }
    })
    await services.transactionsService.create(transactionRequest)

    const transactionRequestResponse: TransactionRequestsIDPutResponse = {
      transactionId: '456',
      transactionRequestState: 'RECEIVED'
    }
    await transactionRequestResponseHandler(services, transactionRequestResponse, { 'fspiop-source': 'payerFSP', 'fspiop-destination': 'payeeFSP' }, '123')

    const quoteRequest = QuotesPostRequestFactory.build({
      quoteId: 'quote123',
      transactionRequestId: '123',
      transactionId: '456',
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
    const ilp = new sdk.Ilp({ secret: 'test' })
    transferRequestIlpPacket = ilp.getQuoteResponseIlp(quoteRequest, quoteResponse).ilpPacket
    await quotesRequestHandler(services, quoteRequest, headers)

    await authorizationRequestHandler(services, '123', headers)

    const legacyFinancialRequest: LegacyFinancialRequest = {
      lpsFinancialRequestMessageId: 'financialRequestId', // TODO: refactor once db and services are refactored
      lpsId: 'lps1',
      lpsKey: 'lps1-001-abc',
      authenticationInfo: {
        authenticationType: 'OTP',
        authenticationValue: '1515'
      },
      responseType: 'ENTERED'
    }

    await legacyFinancialRequestHandler(services, legacyFinancialRequest)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('creates transfer', async () => {
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket: transferRequestIlpPacket
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    const transfer = await services.transfersService.get(transferRequest.transferId)
    expect(transfer).toMatchObject({
      transferId: transferRequest.transferId,
      quoteId: 'quote123',
      transactionRequestId: '123',
      fulfilment: services.transfersService.calculateFulfilment(transferRequest.ilpPacket),
      transferState: TransferState.reserved,
      amount: transferRequest.amount
    })
  })

  test('sends transfer response and updates transaction state to fulfillmentSent', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket: transferRequestIlpPacket,
      payerFsp: 'payerFSP'
    })
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferRequestHandler(services, transferRequest, headers)

    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.fulfillmentSent)

    const transferResponse: TransfersIDPutResponse = {
      fulfilment: services.transfersService.calculateFulfilment(transferRequest.ilpPacket),
      transferState: TransferState.committed,
      completedTimestamp: (new Date(Date.now())).toISOString()
    }
    expect(services.mojaClient.putTransfers).toHaveBeenCalledWith(transferRequest.transferId, transferResponse, 'payerFSP')
  })

  test('sends transfer error if fails to process transfer request', async () => {
    services.transfersService.create = jest.fn().mockRejectedValue({ message: 'Failed to create transfer.' })
    const transferRequest = TransferPostRequestFactory.build({
      amount: {
        amount: '107',
        currency: 'USD'
      },
      ilpPacket: transferRequestIlpPacket,
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
