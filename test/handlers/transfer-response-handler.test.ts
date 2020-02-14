import Knex from 'knex'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { transferResponseHandler } from '../../src/handlers/transfer-response-handler'
import { LegacyFinancialResponse } from '../../src/types/adaptor-relay-messages'
import { TransactionState, Transaction, TransferState } from '../../src/models'
import { Model } from 'objection'
const uuid = require('uuid/v4')

describe('Transfer Response Handler', () => {
  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const transactionInfo = {
    lpsId: 'lps1',
    lpsKey: 'lps1-001-abc',
    transactionRequestId: uuid(),
    initiator: 'PAYEE',
    initiatorType: 'DEVICE',
    scenario: 'WITHDRAWAL',
    amount: '100',
    currency: 'USD',
    state: TransactionState.fulfillmentSent,
    expiration: new Date(Date.now()).toUTCString(),
    authenticationType: 'OTP',
    transfer: {
      id: uuid(),
      quoteId: uuid(),
      state: TransferState.reserved,
      amount: '107',
      currency: 'USD',
      fulfillment: 'test-fulfillment'
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

  test('creates legacy financial response message for a COMMITTED transfer and puts it on the correct LPS Financial Response queue', async () => {
    await Transaction.query().insertGraphAndFetch(transactionInfo)
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
      lpsFinancialRequestMessageId: 'lpsMessageId' // TODO: refactor once DB schema and services are refactored.
    }
    expect(services.queueService.addToQueue).toHaveBeenCalledWith('lps1FinancialResponses', legacyFinancialResponse)
  })

  test('update Transaction State to Financial Response', async () => {
    let transaction = await Transaction.query().insertGraphAndFetch(transactionInfo)
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

})
