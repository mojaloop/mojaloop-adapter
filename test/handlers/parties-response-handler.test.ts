import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { partiesResponseHandler } from '../../src/handlers/parties-response-handler'
import { PartiesPutResponseFactory } from '../factories/mojaloop-messages'
import { TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Parties Response Handler', () => {
  const services = AdaptorServicesFactory.build()
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
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

  test('updates the fspId of the payer', async () => {
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 1000).toUTCString() })
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
    const transaction = await Transaction.query().insertGraphAndFetch({ ...transactionInfo, expiration: new Date(Date.now() + 1000).toUTCString() })
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

    expect(services.logger.error).toHaveBeenCalledWith('Parties response handler: Could not process party response. Transaction not found')
  })
})
