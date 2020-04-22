import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { ISO0100Factory } from '../factories/iso-messages'
import { authorizationRequestHandler } from '../../src/handlers/authorization-request-handler'
import { TransactionState, Transaction, LpsMessage, LegacyMessageType } from '../../src/models'
import { Model } from 'objection'
import { ResponseType } from '../../src/types/adaptor-relay-messages'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

describe('Authorization Request Handler', function () {
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
    state: TransactionState.quoteResponded,
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

  test('puts LegacyAuthorizationResponse message on to AuthorizationResponses queue for the lps that the transaction request came from', async () => {
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    const transaction = await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1AuthorizationResponses', {
      lpsAuthorizationRequestMessageId: legacyAuthRequest.id,
      response: ResponseType.approved,
      fees: {
        amount: '7',
        currency: 'USD'
      },
      transferAmount: {
        amount: '107',
        currency: 'USD'
      }
    })
  })

  test('updates transaction state to be authSent', async () => {
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    let transaction = await Transaction.query().insertGraph({ ...transactionInfo, expiration: new Date(Date.now() + 10000).toUTCString() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    transaction = await transaction.$query()
    expect(transaction.state).toBe(TransactionState.authSent)
    expect(transaction.previousState).toBe(TransactionState.quoteResponded)
  })

  test('sends error message if it fails to process the authorization request', async () => {
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    expect(services.authorizationsService.sendAuthorizationsErrorResponse).toHaveBeenCalled()
  })

  test('sends a 3300 authorization error message and queues an invalid transaction message to the LPS if transaction is not valid', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    const transaction = await Transaction.query().insertGraph({ ...transactionInfo, state: TransactionState.transactionCancelled })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    const sendHeaders = {
      'fspiop-destination': headers['fspiop-source'],
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    expect(services.authorizationsService.sendAuthorizationsErrorResponse).toHaveBeenCalledWith(transactionInfo.transactionRequestId, { errorCode: '3300', errorDescription: 'Transaction is no longer valid.' }, sendHeaders)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1AuthorizationResponses', { lpsAuthorizationRequestMessageId: legacyAuthRequest.id, response: ResponseType.invalid })
  })

  test('sends a 3205 quote not found error and queues an invalid transaction message to the LPS if a quote does not exist', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    const { quote, ...transactionInfoWithoutQuote } = transactionInfo
    const transaction = await Transaction.query().insertGraph({ ...transactionInfoWithoutQuote, expiration: new Date(Date.now() + 10000).toUTCString() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    const sendHeaders = {
      'fspiop-destination': headers['fspiop-source'],
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    expect(services.authorizationsService.sendAuthorizationsErrorResponse).toHaveBeenCalledWith(transactionInfo.transactionRequestId, { errorCode: '3305', errorDescription: 'Quote not found.' }, sendHeaders)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1AuthorizationResponses', { lpsAuthorizationRequestMessageId: legacyAuthRequest.id, response: ResponseType.invalid })
  })

  test('sends a 3202 quote expired error and queues an invalid transaction message to the LPS if the quote has expired', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }
    const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
    const { quote, ...transactionInfoWithoutQuote } = transactionInfo
    quote.expiration = new Date(Date.now() - 1000).toUTCString()
    const transaction = await Transaction.query().insertGraph({ ...transactionInfoWithoutQuote, quote, expiration: new Date(Date.now() + 10000).toUTCString() })
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)

    await authorizationRequestHandler(services, transactionInfo.transactionRequestId, headers)

    const sendHeaders = {
      'fspiop-destination': headers['fspiop-source'],
      'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
      date: new Date().toUTCString(),
      'content-type': 'application/vnd.interoperability.authorizations+json;version=1.0'
    }

    expect(services.authorizationsService.sendAuthorizationsErrorResponse).toHaveBeenCalledWith(transactionInfo.transactionRequestId, { errorCode: '3302', errorDescription: 'Quote has expired.' }, sendHeaders)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1AuthorizationResponses', { lpsAuthorizationRequestMessageId: legacyAuthRequest.id, response: ResponseType.invalid })
  })
})
