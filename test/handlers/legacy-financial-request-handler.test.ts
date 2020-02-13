import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { Money, AuthorizationsIDPutResponse } from '../../src/types/mojaloop'
import { KnexQuotesService } from '../../src/services/quotes-service'
import { legacyFinancialRequestHandler } from '../../src/handlers/legacy-financial-request-handler'
import { LegacyFinancialRequest } from '../../src/types/adaptor-relay-messages'
import { TransactionState, Transaction } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

describe('Legacy Financial Request Handler', () => {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const calculateAdaptorFees = async (amount: Money) => ({ amount: '2', currency: 'USD' })
  const logger = Logger
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
    state: TransactionState.authSent,
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
    quote: {
      id: uuid(),
      transferAmount: '107',
      transferAmountCurrency: 'USD',
      amount: '100',
      amountCurrency: 'USD',
      feeAmount: '7',
      feeCurrency: 'USD',
      ilpPacket: 'test-packet',
      condition: 'test-condition',
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
    services.quotesService = new KnexQuotesService({ knex, ilpSecret: 'secret', logger, calculateAdaptorFees })
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

  test('sends authorization response and updates state to financialRequestSent', async () => {
    let transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
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
      'fspiop-destination': 'mojawallet',
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
    transaction = await transaction.$query()
    expect(services.authorizationsService.sendAuthorizationsResponse).toHaveBeenCalledWith(transactionInfo.transactionRequestId, authorizationsResponse, headers)
    expect(transaction.state).toEqual(TransactionState.financialRequestSent)
    expect(transaction.previousState).toEqual(TransactionState.authSent)
  })

  test.todo('maps the legacy financial request message to the transaction')
})
