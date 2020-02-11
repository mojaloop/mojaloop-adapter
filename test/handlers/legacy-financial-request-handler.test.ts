import Knex from 'knex'
import Axios, { AxiosInstance } from 'axios'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { KnexTransactionsService, TransactionState } from '../../src/services/transactions-service'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { KnexIsoMessageService } from '../../src/services/iso-message-service'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'
import { Money, TransactionRequestsIDPutResponse, AuthorizationsIDPutResponse } from '../../src/types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { quotesRequestHandler } from '../../src/handlers/quotes-handler'
import { authorizationRequestHandler } from '../../src/handlers/authorization-request-handler'
import { transactionRequestResponseHandler } from '../../src/handlers/transaction-request-response-handler'
import { legacyFinancialRequestHandler } from '../../src/handlers/legacy-financial-request-handler'
import { LegacyFinancialRequest } from '../../src/types/adaptor-relay-messages'
const Logger = require('@mojaloop/central-services-logger')

describe('Legacy Authorization Respone Handler', () => {
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
        transactionRequestId: '123',
        transactionId: '456',
        amount: {
          amount: '100',
          currency: 'USD'
        }
      })
      await quotesRequestHandler(services, quoteRequest, headers)

      await authorizationRequestHandler(services, '123', headers)
    })
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('sends authorization response and updates state to financialRequestSent', async () => {
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

    const headers = {
      'fspiop-destination': 'payerFSP',
      'fspiop-source': 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }
    const authorizationsResponse: AuthorizationsIDPutResponse = {
      authenticationInfo: {
        authentication: 'OTP',
        authenticationValue: '1515'
      },
      responseType: 'ENTERED'
    }
    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(services.authorizationsService.sendAuthorizationsResponse).toHaveBeenCalledWith('123', authorizationsResponse, headers)
    expect(transaction.state).toEqual(TransactionState.financialRequestSent)
  })
})
