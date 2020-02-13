import Knex from 'knex'
import { Model } from 'objection'
import { AdaptorServicesFactory } from '../factories/adaptor-services'
import { LegacyAuthorizationRequestFactory } from '../factories/adaptor-legacy-messages'
import { legacyAuthorizationRequestHandler } from '../../src/handlers/legacy-authorization-handler'
import { Transaction, TransactionState } from '../../src/models/transaction'
import { ISO0100Factory } from '../factories/iso-messages'
import { LpsMessage, LegacyMessageType } from '../../src/models/lpsMessage'

jest.mock('uuid/v4', () => () => '123')

describe('Legacy Authorization Request Handler', () => {

  let knex: Knex
  const services = AdaptorServicesFactory.build()
  const iso0100 = ISO0100Factory.build()

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

  test('creates transaction with state transactionReceived', async () => {
    const lpsMessage = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage.id,
      lpsFee: {
        amount: '1',
        currency: 'USD'
      }
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest)

    const transaction = await Transaction.query().where('transactionRequestId', '123').withGraphFetched('[fees, payer, payee]').first()

    expect(transaction).toMatchObject({
      transactionRequestId: '123',
      amount: legacyAuthorizationRequest.amount.amount,
      currency: legacyAuthorizationRequest.amount.currency,
      initiator: 'PAYEE',
      initiatorType: legacyAuthorizationRequest.transactionType.initiatorType,
      scenario: legacyAuthorizationRequest.transactionType.scenario,
      authenticationType: 'OTP',
      expiration: legacyAuthorizationRequest.expiration,
      state: TransactionState.transactionReceived
    })
    expect(transaction.payee).toMatchObject({
      type: 'payee',
      identifierType: legacyAuthorizationRequest.payee.partyIdType,
      identifierValue: legacyAuthorizationRequest.payee.partyIdentifier,
      fspId: 'adaptor'
    })
    expect(transaction.payer).toMatchObject({
      type: 'payer',
      identifierType: legacyAuthorizationRequest.payer.partyIdType,
      identifierValue: legacyAuthorizationRequest.payer.partyIdentifier
    })
    expect(transaction.fees).toHaveLength(1)
    expect(transaction.fees![0]).toMatchObject({
      type: 'lps',
      amount: '1',
      currency: 'USD'
    })
  })

  test('maps the lpsAuthorizationRequestMessage to the transaction', async () => {
    const lpsMessage = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage.id
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest)

    const transaction = await Transaction.query().where('transactionRequestId', '123').withGraphFetched('lpsMessages').first()
    expect(transaction.lpsMessages).toHaveLength(1)
    expect(transaction.lpsMessages![0]).toEqual(lpsMessage)
  })

  test('requests an account lookup', async () => {
    const lpsMessage = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage.id
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest)

    expect(services.mojaClient.getParties).toHaveBeenCalledWith(legacyAuthorizationRequest.payer.partyIdType, legacyAuthorizationRequest.payer.partyIdentifier, null)
  })

  test('marks incomplete transactions from the same device as cancelled', async () => {
    const legacyAuthorizationRequest1 = LegacyAuthorizationRequestFactory.build()
    const incompleteTransaction = await Transaction.query().insertGraphAndFetch({
      transactionRequestId: '122',
      lpsId: legacyAuthorizationRequest1.lpsId,
      lpsKey: legacyAuthorizationRequest1.lpsKey,
      amount: legacyAuthorizationRequest1.amount.amount,
      currency: legacyAuthorizationRequest1.amount.currency,
      expiration: legacyAuthorizationRequest1.expiration,
      initiator: 'PAYEE',
      initiatorType: legacyAuthorizationRequest1.transactionType.initiatorType,
      scenario: legacyAuthorizationRequest1.transactionType.scenario,
      state: TransactionState.transactionReceived,
      authenticationType: 'OTP',
      payer: {
        type: 'payer',
        identifierType: legacyAuthorizationRequest1.payer.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payer.partyIdentifier
      },
      payee: {
        type: 'payee',
        identifierType: legacyAuthorizationRequest1.payee.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payee.partyIdentifier,
        subIdOrType: legacyAuthorizationRequest1.payee.partySubIdOrType,
        fspId: process.env.ADAPTOR_FSP_ID || 'adaptor'
      }
    })
    const lpsMessage2 = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest2 = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage2.id
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest2)

    expect((await incompleteTransaction.$query()).state).toBe(TransactionState.transactionCancelled)
  })

  test('does not mark completed transactions from the same device as cancelled', async () => {
    const legacyAuthorizationRequest1 = LegacyAuthorizationRequestFactory.build()
    const completeTransaction = await Transaction.query().insertGraphAndFetch({
      transactionRequestId: '122',
      lpsId: legacyAuthorizationRequest1.lpsId,
      lpsKey: legacyAuthorizationRequest1.lpsKey,
      amount: legacyAuthorizationRequest1.amount.amount,
      currency: legacyAuthorizationRequest1.amount.currency,
      expiration: legacyAuthorizationRequest1.expiration,
      initiator: 'PAYEE',
      initiatorType: legacyAuthorizationRequest1.transactionType.initiatorType,
      scenario: legacyAuthorizationRequest1.transactionType.scenario,
      state: TransactionState.financialResponse,
      authenticationType: 'OTP',
      payer: {
        type: 'payer',
        identifierType: legacyAuthorizationRequest1.payer.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payer.partyIdentifier
      },
      payee: {
        type: 'payee',
        identifierType: legacyAuthorizationRequest1.payee.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payee.partyIdentifier,
        subIdOrType: legacyAuthorizationRequest1.payee.partySubIdOrType,
        fspId: process.env.ADAPTOR_FSP_ID || 'adaptor'
      }
    })
    const lpsMessage2 = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest2 = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage2.id
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest2)

    expect((await completeTransaction.$query()).state).toBe(TransactionState.financialResponse)
  })

  test('does not mark incomplete transactions from a different device as cancelld', async () => {
    const legacyAuthorizationRequest1 = LegacyAuthorizationRequestFactory.build({
      lpsKey: 'lps1-002-def'
    })
    const completeTransaction = await Transaction.query().insertGraphAndFetch({
      transactionRequestId: '122',
      lpsId: legacyAuthorizationRequest1.lpsId,
      lpsKey: legacyAuthorizationRequest1.lpsKey,
      amount: legacyAuthorizationRequest1.amount.amount,
      currency: legacyAuthorizationRequest1.amount.currency,
      expiration: legacyAuthorizationRequest1.expiration,
      initiator: 'PAYEE',
      initiatorType: legacyAuthorizationRequest1.transactionType.initiatorType,
      scenario: legacyAuthorizationRequest1.transactionType.scenario,
      state: TransactionState.transactionReceived,
      authenticationType: 'OTP',
      payer: {
        type: 'payer',
        identifierType: legacyAuthorizationRequest1.payer.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payer.partyIdentifier
      },
      payee: {
        type: 'payee',
        identifierType: legacyAuthorizationRequest1.payee.partyIdType,
        identifierValue: legacyAuthorizationRequest1.payee.partyIdentifier,
        subIdOrType: legacyAuthorizationRequest1.payee.partySubIdOrType,
        fspId: process.env.ADAPTOR_FSP_ID || 'adaptor'
      }
    })
    const lpsMessage2 = await LpsMessage.query().insertAndFetch({ lpsId: 'lps1', lpsKey: 'lps1-001-abc', type: LegacyMessageType.authorizationRequest, content: iso0100 })
    const legacyAuthorizationRequest2 = LegacyAuthorizationRequestFactory.build({
      lpsAuthorizationRequestMessageId: lpsMessage2.id
    })

    await legacyAuthorizationRequestHandler(services, legacyAuthorizationRequest2)

    expect((await completeTransaction.$query()).state).toBe(TransactionState.transactionReceived)
  })
})
