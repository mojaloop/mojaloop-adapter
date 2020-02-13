import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { partiesResponseHandler } from '../../src/handlers/parties-response-handler'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')

describe('Parties Response Handler', () => {
  const services = AdaptorServicesFactory.build()
  let knex: Knex
  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.transactionReceived,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP',
    payer: {
      type: 'payer',
      identifierType: 'MSISDN',
      identifierValue: '0821234567'
    },
    payee: {
      type: 'payee',
      identifierType: 'DEVICE',
      identifierValue: '1234',
      subIdOrType: 'abcd',
      fspId: 'adaptor'
    }
  }

  beforeAll(() => {
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

  test('updates the fspId of the payer', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
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

    expect((await transaction.$query().withGraphFetched('payer')).payer!.fspId).toBe('mojawallet')
  })

  test('makes a transaction request to the Moja switch', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
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

    expect(services.mojaClient.postTransactionRequests).toHaveBeenCalledWith({
      amount: {
        amount: transaction.amount,
        currency: transaction.currency
      },
      payer: {
        partyIdType: transactionInfo.payer.identifierType,
        partyIdentifier: transactionInfo.payer.identifierValue,
        fspId: 'mojawallet'
      },
      payee: {
        partyIdInfo: {
          partyIdType: transactionInfo.payee.identifierType,
          partyIdentifier: transactionInfo.payee.identifierValue,
          partySubIdOrType: transactionInfo.payee.subIdOrType,
          fspId: transactionInfo.payee.fspId
        }
      },
      transactionRequestId: transactionInfo.transactionRequestId,
      transactionType: {
        initiator: transaction.initiator,
        initiatorType: transaction.initiatorType,
        scenario: transaction.scenario
      }
    }, 'mojawallet')
  })

  test('logs error message if there is no fspId in the partiesResponse', async () => {
    await Transaction.query().insertGraphAndFetch(transactionInfo)
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

  test('logs error message if no transaction is found', async () => {
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

    expect(services.logger.error).toHaveBeenCalledWith('Parties response handler: Could not process party response. NotFoundError')
  })
})
