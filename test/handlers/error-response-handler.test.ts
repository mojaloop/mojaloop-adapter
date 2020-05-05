import Knex, { Transaction as KnexTransaction } from "knex"
import { Model } from "objection"
import { AdaptorServicesFactory } from "../factories/adaptor-services"
import { TransactionState, Transaction, LpsMessage, LegacyMessageType, Quote, Transfers, TransferState } from "../../src/models"
import { ResponseType } from "../../src/types/adaptor-relay-messages"
import { ISO0100Factory, ISO0200Factory, ISO0420Factory } from "../factories/iso-messages"
import { errorResponseHandler } from '../../src/handlers/error-response-handler'
import { MojaloopErrorQueueMessage, MojaloopError } from "../../src/types/queueMessages"
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

describe('Error Response Handler', () => {
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
    state: TransactionState.transactionReceived,
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

  describe('non-reversal errors', () => {
    test('queues an invalid transaction message to the LPS for a quote error message', async () => {
      const transaction = await Transaction.query().insertGraph(Object.assign({ ...transactionInfo, state: TransactionState.quoteResponded, expiration: new Date(Date.now() + 10000).toUTCString() }))
      const quote = await transaction.$relatedQuery<Quote>('quote').insertAndFetch({
        id: uuid(),
        transactionId: transactionInfo.transactionId,
        transferAmount: '100',
        transferAmountCurrency: 'USD',
        amount: '100',
        amountCurrency: 'USD',
        feeAmount: '0',
        feeCurrency: 'USD',
        ilpPacket: 'ilppacket',
        condition: 'condition',
        expiration: new Date(Date.now() + 10000).toUTCString()
      })
      const legacyAuthRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.authorizationRequest, content: ISO0100Factory.build() })
      await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyAuthRequest)
      const errorMessage: MojaloopErrorQueueMessage = {
        type: MojaloopError.quote,
        typeId: quote.id,
        errorInformation: {
          errorCode: '2001',
          errorDescription: 'An internal error occured'
        }
      }

      await errorResponseHandler(services, errorMessage)
  
      expect(services.queueService.addToQueue).toHaveBeenCalledWith(transactionInfo.lpsId + 'AuthorizationResponses', { lpsAuthorizationRequestMessageId: legacyAuthRequest.id, response: ResponseType.invalid })
      expect((await transaction.$query()).state).toBe(TransactionState.transactionCancelled)
    })

    test('queues an invalid transaction message to the LPS for a transfer error message', async () => {
      const transaction = await Transaction.query().insertGraph(Object.assign({ ...transactionInfo, state: TransactionState.financialRequestSent, expiration: new Date(Date.now() + 10000).toUTCString() }))
      const quote = await transaction.$relatedQuery<Quote>('quote').insertAndFetch({
        id: uuid(),
        transactionId: transactionInfo.transactionId,
        transferAmount: '100',
        transferAmountCurrency: 'USD',
        amount: '100',
        amountCurrency: 'USD',
        feeAmount: '0',
        feeCurrency: 'USD',
        ilpPacket: 'ilppacket',
        condition: 'condition',
        expiration: new Date(Date.now() + 10000).toUTCString()
      })
      const legacyFinancialRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.financialRequest, content: ISO0200Factory.build() })
      await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyFinancialRequest)
      const transfer = await transaction.$relatedQuery<Transfers>('transfer').insertAndFetch({
        id: uuid(),
        quoteId: quote.id,
        state: TransferState.reserved,
        amount: '100',
        currency: 'USD',
        fulfillment: 'test-fulfillment'
      })
      const errorMessage: MojaloopErrorQueueMessage = {
        type: MojaloopError.transfer,
        typeId: transfer.id,
        errorInformation: {
          errorCode: '2001',
          errorDescription: 'An internal error occured'
        }
      }

      await errorResponseHandler(services, errorMessage)
  
      expect(services.queueService.addToQueue).toHaveBeenCalledWith(transactionInfo.lpsId + 'FinancialResponses', { lpsFinancialRequestMessageId: legacyFinancialRequest.id, response: ResponseType.invalid })
      expect((await transaction.$query()).state).toBe(TransactionState.transactionCancelled)
    })
  })

  describe('reversal errors', () => {
    test('queues an invalid transaction message to the LPS for a quote error message', async () => {
      const transaction = await Transaction.query().insertGraph(Object.assign({ ...transactionInfo, state: TransactionState.quoteResponded, expiration: new Date(Date.now() + 10000).toUTCString(), originalTransactionId: transactionInfo.transactionId }))
      const quote = await transaction.$relatedQuery<Quote>('quote').insertAndFetch({
        id: uuid(),
        transactionId: transactionInfo.transactionId,
        transferAmount: '100',
        transferAmountCurrency: 'USD',
        amount: '100',
        amountCurrency: 'USD',
        feeAmount: '0',
        feeCurrency: 'USD',
        ilpPacket: 'ilppacket',
        condition: 'condition',
        expiration: new Date(Date.now() + 10000).toUTCString()
      })
      const legacyReversalRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.reversalRequest, content: ISO0420Factory.build() })
      await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyReversalRequest)
      const errorMessage: MojaloopErrorQueueMessage = {
        type: MojaloopError.quote,
        typeId: quote.id,
        errorInformation: {
          errorCode: '2001',
          errorDescription: 'An internal error occured'
        }
      }

      await errorResponseHandler(services, errorMessage)
  
      expect(services.queueService.addToQueue).toHaveBeenCalledWith(transactionInfo.lpsId + 'ReversalResponses', { lpsReversalRequestMessageId: legacyReversalRequest.id, response: ResponseType.invalid })
      expect((await transaction.$query()).state).toBe(TransactionState.transactionCancelled)
    })
  })
})