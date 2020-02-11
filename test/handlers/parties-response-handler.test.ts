import { AdaptorServicesFactory } from '../factories/adaptor-services'
import Axios from 'axios'
import Knex from 'knex'
import { KnexTransactionsService } from '../../src/services/transactions-service'
import { partiesResponseHandler } from '../../src/handlers/parties-response-handler'
import { TransactionRequestFactory } from '../factories/transaction-requests'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
const Logger = require('@mojaloop/central-services-logger')

describe('Parties Response Handler', () => {
  const services = AdaptorServicesFactory.build()
  let knex: Knex

  beforeAll(() => {
    knex = Knex({
      client: 'sqlite3',
      connection: {
        filename: ':memory:',
        supportBigNumbers: true
      },
      useNullAsDefault: true
    })
  })

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
    const httpClient = Axios.create()
    services.transactionsService = new KnexTransactionsService({ knex, client: httpClient, logger })
    services.transactionsService.sendToMojaHub = jest.fn().mockResolvedValue(undefined)
  })

  beforeEach(async () => {
    await knex.migrate.latest()

    const transactionRequest = TransactionRequestFactory.build({
      transactionRequestId: '123',
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: '0821234567'
      }
    })

    await services.transactionsService.create(transactionRequest)
  })

  afterEach(async () => {
    await knex.migrate.rollback()
  })

  afterAll(async () => {
    await knex.destroy()
  })

  test('updates the fspId of the payer', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build({
      party: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '0821234567',
          fspId: 'mojawallet'
        }
      }
    })

    await partiesResponseHandler(services, putPartiesResponse, '0821234567')

    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(transaction.payer.fspId).toBe('mojawallet')
  })

  test('makes a transaction request to the Moja switch', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build({
      party: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '0821234567',
          fspId: 'mojawallet'
        }
      }
    })

    await partiesResponseHandler(services, putPartiesResponse, '0821234567')

    const transaction = await services.transactionsService.get('123', 'transactionRequestId')
    expect(services.mojaClient.postTransactionRequests).toHaveBeenCalledWith({
      amount: transaction.amount,
      payer: transaction.payer,
      payee: transaction.payee,
      transactionRequestId: '123',
      transactionType: transaction.transactionType
    }, 'mojawallet')
  })

  test('logs error message if it cannot process the partiesResponse', async () => {
    const putPartiesResponse = PartiesPutResponseFactory.build({
      party: {
        partyIdInfo: {
          partyIdType: 'MSISDN',
          partyIdentifier: '0821234567'
        }
      }
    })

    await partiesResponseHandler(services, putPartiesResponse, '0821234567')

    expect(services.logger.error).toHaveBeenCalledWith('Parties response handler: Could not process party response. No fspId.')
  })
})
