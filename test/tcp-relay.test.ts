import Knex from 'knex'
import { Model } from 'objection'
import { Socket } from 'net'
import { DefaultIso8583TcpRelay, LegacyMessage } from '../src/tcp-relay'
import { iso0100BinaryMessage, iso0200BinaryMessage } from './factories/iso-messages'
import { LegacyAuthorizationRequest, LegacyFinancialRequest, LegacyAuthorizationResponse, LegacyFinancialResponse } from '../src/types/adaptor-relay-messages'
import { LpsMessage, LegacyMessageType } from '../src/models'

const IsoParser = require('iso_8583')
const Logger = require('@mojaloop/central-services-logger')
Logger.log = Logger.info

describe('TCP relay', function () {

  let knex: Knex
  let relay: DefaultIso8583TcpRelay
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
    relay = new DefaultIso8583TcpRelay({ decode, encode, logger: Logger, queueService, socket: client }, { lpsId: 'lps1' })
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

  test('maps 0100 to a legacy authorization request and puts it on the legacyAuthorizationRequests queue', async () => {
    const json0100 = new IsoParser().getIsoJSON(iso0100BinaryMessage)
    const expirationDate = new Date()
    expirationDate.setMonth(Number(json0100[7].slice(0, 2)) - 1, Number(json0100[7].slice(2, 4)))
    expirationDate.setHours(Number(json0100[7].slice(4, 6)) - 1, Number(json0100[7].slice(6, 8)), Number(json0100[7].slice(-2)))

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
      expiration: expirationDate.toUTCString(),
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

  test('encodes legacy authorization response and sends over socket', async () => {
    client.write = jest.fn()
    const json0100 = new IsoParser().getIsoJSON(iso0100BinaryMessage)
    json0100[127.2] = '100222'
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0100[41]}-${json0100[42]}`, content: json0100 })
    const legacyAuthorizationResponse: LegacyAuthorizationResponse = {
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

  test('encodes legacy financial response and sends over socket', async () => {
    client.write = jest.fn().mockReturnValue(undefined)
    const json0200 = new IsoParser().getIsoJSON(iso0200BinaryMessage)
    const lpsMessage = await LpsMessage.query().insertAndFetch({ type: LegacyMessageType.authorizationRequest, lpsId: 'lps1', lpsKey: `lps1-${json0200[41]}-${json0200[42]}`, content: json0200 })
    const legacyFinancialResponse: LegacyFinancialResponse = {
      lpsFinancialRequestMessageId: lpsMessage.id
    }

    await relay.handleFinancialResponse(legacyFinancialResponse)

    expect(client.write).toHaveBeenCalledWith(encode({ ...json0200, 0: '0210', 39: '00' }))
  })
})
