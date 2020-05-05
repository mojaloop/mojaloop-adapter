import Knex, { Transaction as KnexTransaction } from 'knex'
import { Model } from 'objection'
import { Socket } from 'net'
import { DefaultIso8583_87TcpRelay } from '../../src/relays/default-iso8583-87'
import { iso0100BinaryMessage, iso0200BinaryMessage, ISO0100Factory, ISO0420Factory } from '../factories/iso-messages'
import { LegacyAuthorizationRequest, LegacyFinancialRequest, LegacyAuthorizationResponse, LegacyFinancialResponse, ResponseType, LegacyReversalResponse } from '../../src/types/adaptor-relay-messages'
import { LpsMessage, LegacyMessageType } from '../../src/models'
import { LegacyMessage } from '../../src/types/tcpRelay'
const knexConfig = require('../../knexfile')
const IsoParser = require('iso_8583')
const Logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}

describe('TCP relay', function () {

  const dbConfig = process.env.DB_CONFIG || 'sqlite'
  const knex = Knex(knexConfig[dbConfig])
  let trx: KnexTransaction
  let relay: DefaultIso8583_87TcpRelay
  const client = new Socket()
  const encode = (message: LegacyMessage): Buffer => {
    return new IsoParser(message).getBufferMessage()
  }
  const decode = (data: Buffer): LegacyMessage => {
    return new IsoParser().getIsoJSON(data)
  }
  const queueService = {
    addToQueue: jest.fn(),
    shutdown: jest.fn(),
    getQueues: jest.fn()
  }
  const transactionExpiryWindow = 10

  beforeAll(async () => {
    if (dbConfig === 'sqlite') {      
      await knex.migrate.latest()
    }
    relay = new DefaultIso8583_87TcpRelay({ decode, encode, logger: Logger, queueService, socket: client }, { lpsId: 'lps1', transactionExpiryWindow })
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

  test('maps 0100 to a legacy authorization request and puts it on the legacyAuthorizationRequests queue', async () => {
    Date.now = jest.fn().mockReturnValue(0)
    const json0100 = new IsoParser().getIsoJSON(iso0100BinaryMessage)

    client.emit('data', iso0100BinaryMessage)

    await new Promise(resolve => { setTimeout(() => resolve(), 100) })
    const lpsMessage = await LpsMessage.query().first()
    const expectedLegacyAuthorizationRequest: LegacyAuthorizationRequest = {
      lpsId: 'lps1',
      lpsKey: `lps1-${json0100[41]}-${json0100[42]}`,
      lpsAuthorizationRequestMessageId: lpsMessage.id,
      amount: {
        amount: '400',
        currency: 'USD'
      },
      expiration: new Date(Date.now() + transactionExpiryWindow * 1000).toUTCString(),
      payee: {
        partyIdType: 'DEVICE',
        partyIdentifier: json0100[41],
        partySubIdOrType: json0100[42]
      },
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: json0100[102]
      },
      transactionType: {
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      lpsFee: {
        amount: '4',
        currency: 'USD'
      }
    }
    expect(queueService.addToQueue).toHaveBeenCalledWith('LegacyAuthorizationRequests', expectedLegacyAuthorizationRequest)
  })

  test('maps 0110 to a legacy authorization request and puts it on the legacyFinancialRequests queue', async () => {
    const json0200 = new IsoParser().getIsoJSON(iso0200BinaryMessage)

    client.emit('data', iso0200BinaryMessage)

    await new Promise(resolve => { setTimeout(() => resolve(), 100) })
    const lpsMessage = await LpsMessage.query().first()
    const expectedLegacyFinancialRequest: LegacyFinancialRequest = {
      lpsId: 'lps1',
      lpsKey: `lps1-${json0200[41]}-${json0200[42]}`,
      lpsFinancialRequestMessageId: lpsMessage.id,
      responseType: 'ENTERED',
      authenticationInfo: {
        authenticationType: 'OTP',
        authenticationValue: json0200[103]
      }
    }
    expect(queueService.addToQueue).toHaveBeenCalledWith('LegacyFinancialRequests', expectedLegacyFinancialRequest)
  })

  test('encodes approved legacy authorization response and sends over socket', async () => {
    client.write = jest.fn()
    const json0100 = new IsoParser().getIsoJSON(iso0100BinaryMessage)
    json0100[127.2] = '100222'
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0100[41]}-${json0100[42]}`, content: json0100 })
    const legacyAuthorizationResponse: LegacyAuthorizationResponse = {
      response: ResponseType.approved,
      fees: {
        amount: '4',
        currency: 'USD'
      },
      lpsAuthorizationRequestMessageId: lpsMessage.id,
      transferAmount: {
        amount: '104',
        currency: 'USD'
      }
    }

    await relay.handleAuthorizationResponse(legacyAuthorizationResponse)

    expect(client.write).toHaveBeenCalledWith(encode({ ...json0100, 0: '0110', 30: 'D00000400', 39: '00', 48: '104' }))
  })

  test('encodes declined legacy authorization response and sends over socket', async () => {
    client.write = jest.fn()
    const json0100 = new IsoParser().getIsoJSON(iso0100BinaryMessage)
    json0100[127.2] = '100222'
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0100[41]}-${json0100[42]}`, content: json0100 })
    const legacyAuthorizationResponse: LegacyAuthorizationResponse = {
      response: ResponseType.invalid,
      lpsAuthorizationRequestMessageId: lpsMessage.id
    }

    await relay.handleAuthorizationResponse(legacyAuthorizationResponse)

    expect(client.write).toHaveBeenCalledWith(encode({ ...json0100, 0: '0110', 39: 'N0' }))
  })

  test('encodes legacy financial response and sends over socket', async () => {
    client.write = jest.fn().mockReturnValue(undefined)
    const json0200 = new IsoParser().getIsoJSON(iso0200BinaryMessage)
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0200[41]}-${json0200[42]}`, content: json0200 })
    const legacyFinancialResponse: LegacyFinancialResponse = {
      lpsFinancialRequestMessageId: lpsMessage.id,
      response: ResponseType.approved
    }

    await relay.handleFinancialResponse(legacyFinancialResponse)

    expect(client.write).toHaveBeenCalledWith(encode({ ...json0200, 0: '0210', 39: '00' }))
  })

  test('encodes reversal response and sends over socket', async () => {
    client.write = jest.fn().mockReturnValue(undefined)
    const json0420 = ISO0420Factory.build()
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0420[41]}-${json0420[42]}`, content: json0420 })
    const legacyReversalResponse: LegacyReversalResponse = {
      lpsReversalRequestMessageId: lpsMessage.id,
      response: ResponseType.approved
    }

    await relay.handleReversalResponse(legacyReversalResponse)

    expect(client.write).toHaveBeenCalledWith(encode({ ...json0420, 0: '0430', 39: '00' }))
  })

  test('matches a legacy reversal advice to a previous legacy request that has no acquirer or forwarding institution id', async () => {
    const iso0100 = ISO0100Factory.build({
      7: '0130083636',
      11: '000008',
      12: '103636',
      28: 'D00000100'
    })
    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360000000000000000000000'
    })

    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0100[41]}-${iso0100[42]}`, content: iso0100 })
    const reversalMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.reversalRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`, content: iso0420 })

    const legacyReversal = await relay.mapFromReversalAdvice(reversalMessage.id, iso0420)

    expect(legacyReversal).toEqual({
      lpsId: 'lps1',
      lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`,
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsReversalRequestMessageId: reversalMessage.id
    })
  })

  test('matches a legacy reversal advice to a previous legacy request that has an acquirer id', async () => {
    const iso0100 = ISO0100Factory.build({
      7: '0130083636',
      11: '000008',
      12: '103636',
      28: 'D00000100',
      32: '708400003'
    })
    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360070840000300000000000'
    })

    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0100[41]}-${iso0100[42]}`, content: iso0100 })
    const reversalMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.reversalRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`, content: iso0420 })

    const legacyReversal = await relay.mapFromReversalAdvice(reversalMessage.id, iso0420)

    expect(legacyReversal).toEqual({
      lpsId: 'lps1',
      lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`,
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsReversalRequestMessageId: reversalMessage.id
    })
  })

  test('matches a legacy reversal advice to a previous legacy request that has a forwarding institution id', async () => {
    const iso0100 = ISO0100Factory.build({
      7: '0130083636',
      11: '000008',
      12: '103636',
      28: 'D00000100',
      33: '708400003'
    })
    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360000000000000708400003'
    })

    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0100[41]}-${iso0100[42]}`, content: iso0100 })
    const reversalMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.reversalRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`, content: iso0420 })

    const legacyReversal = await relay.mapFromReversalAdvice(reversalMessage.id, iso0420)

    expect(legacyReversal).toEqual({
      lpsId: 'lps1',
      lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`,
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsReversalRequestMessageId: reversalMessage.id
    })
  })

  test('maps it to a legacy reversal request and puts it on the LegacyReversalRequests queue', async () => {
    client.write = jest.fn()
    const iso0100 = ISO0100Factory.build({
      7: '0130083636',
      11: '000008',
      12: '103636',
      28: 'D00000100'
    })
    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360000000000000000000000'
    })
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${iso0100[41]}-${iso0100[42]}`, content: iso0100 })

    client.emit('data', encode(iso0420))
    await new Promise(resolve => { setTimeout(() => resolve(), 100) })

    const reversalMessage = await LpsMessage.query().where({ type: LegacyMessageType.reversalRequest }).first().throwIfNotFound()
    expect(queueService.addToQueue).toHaveBeenCalledWith('LegacyReversalRequests', {
      lpsId: 'lps1',
      lpsKey: `lps1-${iso0420[41]}-${iso0420[42]}`,
      lpsFinancialRequestMessageId: lpsMessage.id,
      lpsReversalRequestMessageId: reversalMessage.id
    })
  })

  test('responds to a 0420 with a 21 response code if it can\'t map it to a legacy reversal request', async () => {
    client.write = jest.fn()
    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360000000000000000000000'
    })

    client.emit('data', encode(iso0420))
    await new Promise(resolve => { setTimeout(() => resolve(), 100) })

    expect(queueService.addToQueue).not.toHaveBeenCalled()
    expect(client.write).toHaveBeenCalledWith(encode({ ...iso0420, 0: '0430', 39: '21' }))
  })

  test('logs error if it fails to handle a message', async () => {
    relay.getMessageType = jest.fn(() => { throw new Error('failed') })

    const iso0420 = ISO0420Factory.build({
      28: 'C00000100',
      90: '010000000801300836360000000000000000000000'
    })

    client.emit('data', encode(iso0420))

    await new Promise(resolve => { setTimeout(() => { resolve() }, 100) })
    expect(Logger.error).toHaveBeenCalledWith('lps1 relay: Failed to handle iso message.')
  })

  test('logs error if an error is raised on the socket', async () => {
    client.emit('error', { message: 'socket error' })

    await new Promise(resolve => { setTimeout(() => { resolve() }, 100) })

    expect(Logger.error).toHaveBeenCalledWith('lps1 relay: Error: socket error')
  })
})
