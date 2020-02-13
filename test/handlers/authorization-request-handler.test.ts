import Knex from 'knex'
import Axios, { AxiosInstance } from 'axios'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { Money, TransactionRequestsIDPutResponse } from '../../src/types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { quotesRequestHandler } from '../../src/handlers/quotes-handler'
import { authorizationRequestHandler } from '../../src/handlers/authorization-request-handler'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { TransactionState } from '../../src/models'
const Logger = require('@mojaloop/central-services-logger')

describe('Authorization Request Handler', function () {
  let knex: Knex
  const fakeHttpClient: AxiosInstance = Axios.create()
  fakeHttpClient.get = jest.fn()
  const services = AdaptorServicesFactory.build()
  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })
  const logger = Logger

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
    services.isoMessagesService = new KnexIsoMessageService(knex)
    services.quotesService = new KnexQuotesService({ knex, ilpSecret: 'secret', logger, calculateAdaptorFees })

    beforeEach(async () => {
      await knex.migrate.latest()

      const transactionRequest = TransactionRequestFactory.build({
        lpsId: 'lps1',
        lpsKey: 'lps-001-abc',
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
        transactionRequestId: '123',
        transactionId: '456',
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      const headers = {
        'fspiop-destination': 'payeeFSP',
        'fspiop-source': 'payerFSP'
      }
      await quotesRequestHandler(services, quoteRequest, headers)
    })
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('puts LegacyAuthorizationResponse message on to AuthorizationResponses queue for the lps that the transaction request came from', async () => {
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await authorizationRequestHandler(services, '123', headers)

    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1AuthorizationResponses', {
      lpsAuthorizationRequestMessageId: 'lpsMessageId', // TODO: refactor once DB schema and services are refactored
      fees: {
        amount: '5',
        currency: 'USD'
      },
      transferAmount: {
        amount: '107',
        currency: 'USD'
      }
    })
  })

  test('updates transaction state to be authSent', async () => {
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await authorizationRequestHandler(services, '123', headers)

    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.state).toBe(TransactionState.authSent)
  })

  test('sends error message if it fails to process the authorization request', async () => {
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }
    services.transactionsService.get = jest.fn().mockRejectedValueOnce({ message: 'Failed to find transaction.' })

    await authorizationRequestHandler(services, '123', headers)

    expect(services.authorizationsService.sendAuthorizationsErrorResponse).toHaveBeenCalled()
  })
})
