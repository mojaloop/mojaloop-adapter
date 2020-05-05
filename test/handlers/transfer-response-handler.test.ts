import Knex, { Transaction as KnexTransaction } from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { transferResponseHandler } from '../../src/handlers/transfer-response-handler'
import { LegacyFinancialResponse, ResponseType } from '../../src/types/adaptor-relay-messages'
import { TransactionState, Transaction, TransferState, LpsMessage, LegacyMessageType, Transfers, Quote } from '../../src/models'
import { Model } from 'objection'
import { ISO0200Factory } from '../factories/iso-messages'
const knexConfig = require('../../knexfile')
const uuid = require('uuid/v4')

describe('Transfer Response Handler', () => {
  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
  const services = AdaptorServicesFactory.build()
  const quoteId = uuid()
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
    state: TransactionState.fulfillmentSent,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP',
    quote: {
      id: quoteId,
      transferAmount: '107',
      transferAmountCurrency: 'USD',
      amount: '100',
      amountCurrency: 'USD',
      feeAmount: '7',
      feeCurrency: 'USD',
      ilpPacket: 'test-packet',
      condition: 'test-condition',
      expiration: new Date(Date.now() + 10000).toUTCString()
    },
    transfer: {
      id: uuid(),
      quoteId: quoteId,
      state: TransferState.reserved,
      amount: '107',
      currency: 'USD',
      fulfillment: 'test-fulfillment'
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

  test('creates legacy financial response message for a COMMITTED transfer and puts it on the correct LPS Financial Response queue', async () => {
    const lpsFinancialRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.financialRequest, content: ISO0200Factory.build() })
    const transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsFinancialRequest)
    const transferResponse = {
      transferId: transactionInfo.transfer.id,
      transferState: 'COMMITTED'
    }
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferResponseHandler(services, transferResponse, headers, transferResponse.transferId)

    const legacyFinancialResponse: LegacyFinancialResponse = {
      lpsFinancialRequestMessageId: lpsFinancialRequest.id,
      response: ResponseType.approved
    }
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1FinancialResponses', legacyFinancialResponse)
  })

  test('update Transaction State to Financial Response', async () => {
    const lpsFinancialRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.financialRequest, content: ISO0200Factory.build() })
    let transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsFinancialRequest)
    const transferResponse = {
      transferId: transactionInfo.transfer.id,
      transferState: 'COMMITTED'
    }
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferResponseHandler(services, transferResponse, headers, transferResponse.transferId)

    transaction = await transaction.$query()
    expect(transaction.state).toBe(TransactionState.financialResponse)
    expect(transaction.previousState).toBe(TransactionState.fulfillmentSent)
  })

  test('updates the transfer state', async () => {
    const lpsFinancialRequest = await LpsMessage.query().insertAndFetch({ lpsId: transactionInfo.lpsId, lpsKey: transactionInfo.lpsKey, type: LegacyMessageType.financialRequest, content: ISO0200Factory.build() })
    const transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(lpsFinancialRequest)
    const transferResponse = {
      transferId: transactionInfo.transfer.id,
      transferState: 'COMMITTED'
    }
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferResponseHandler(services, transferResponse, headers, transferResponse.transferId)

    expect((await Transfers.query().where('id', transactionInfo.transfer.id).first().throwIfNotFound()).state).toBe(TransferState.committed)
  })

  test('queues an approved legacy reversal response for a successful refund transfer', async () => {
    const refundTransactionInfo = {
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
      expiration: new Date(Date.now() + 10000).toUTCString(),
      originalTransactionId: transactionInfo.transactionId,
      authenticationType: 'OTP',
    }
    const legacyReversalRequest = await LpsMessage.query().insertGraphAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.reversalRequest, content: {} })
    const transaction = await Transaction.query().insertGraph(refundTransactionInfo)
    await transaction.$relatedQuery<LpsMessage>('lpsMessages').relate(legacyReversalRequest)
    const refundQuote = await transaction.$relatedQuery<Quote>('quote').insertAndFetch({
      id: uuid(),
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
    const refundTransfer = await transaction.$relatedQuery<Transfers>('transfer').insertAndFetch({
      id: uuid(),
      quoteId: refundQuote.id,
      state: TransferState.reserved,
      amount: '107',
      currency: 'USD',
      fulfillment: 'test-fulfillment'
    })

    const transferResponse = {
      transferId: refundTransfer.id,
      transferState: 'COMMITTED'
    }
    const headers = {
      'fspiop-source': 'payerFSP',
      'fspiop-destination': 'payeeFSP'
    }

    await transferResponseHandler(services, transferResponse, headers, transferResponse.transferId)

    expect((await Transfers.query().where('id', refundTransfer.id).first().throwIfNotFound()).state).toBe(TransferState.committed)
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1ReversalResponses', { lpsReversalRequestMessageId: legacyReversalRequest.id, response: ResponseType.approved })
  })

})
