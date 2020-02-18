import { Server, Socket } from 'net'
import { Worker, Job, ConnectionOptions } from 'bullmq'
import { QueueService } from './services/queue-service'
import { Logger } from './adaptor'
import { LegacyAuthorizationRequest, LegacyAuthorizationResponse, LegacyFinancialRequest, LegacyFinancialResponse } from './types/adaptor-relay-messages'
import { LpsMessage, LegacyMessageType } from './models'
import { Money } from '@mojaloop/sdk-standard-components'
import { pad } from './utils/util'
const MlNumber = require('@mojaloop/ml-number')

export type LegacyMessage = { [k: string]: any }

export interface TcpRelay {
  start: () => Promise<void>;
  shutdown: () => Promise<void>;
  getMessageType: (mti: string) => LegacyMessageType;
  calculateFee: (legacyMessage: LegacyMessage) => Money;
  getTransactionType: (legacyMessage: LegacyMessage) => { initiatorType: 'DEVICE' | 'AGENT'; scenario: 'WITHDRAWAL' | 'REFUND' };
  mapFromAuthorizationRequest: (lpsMessageId: string, legacyMessage: LegacyMessage) => Promise<LegacyAuthorizationRequest>;
  mapToAuthorizationResponse: (authorizationResponse: LegacyAuthorizationResponse) => Promise<LegacyMessage>;
  mapFromFinancialRequest: (lpsMessageId: string, legacyMessage: LegacyMessage) => Promise<LegacyFinancialRequest>;
  mapToFinancialResponse: (financialResponse: LegacyFinancialResponse) => Promise<LegacyMessage>;
}

export type TcpRelayServices = {
  queueService: QueueService;
  logger: Logger;
  encode: (message: { [k: string]: any }) => Buffer;
  decode: (message: Buffer) => { [k: string]: any };
  socket: Socket;
}

export type TcpRelayConfig = {
  lpsId: string;
  redisConnection?: ConnectionOptions;
}

export class DefaultIso8583TcpRelay implements TcpRelay {

  private _logger: Logger
  private _queueService: QueueService
  private _lpsId: string
  private _redisConnection: ConnectionOptions
  private _server?: Server
  private _socket?: Socket

  private _encode: (message: { [k: string]: any }) => Buffer
  private _decode: (message: Buffer) => { [k: string]: any }

  private _authorizationResponseWorker?: Worker
  private _financialResponseWorker?: Worker

  constructor ({ logger, queueService, encode, decode, socket }: TcpRelayServices, { lpsId, redisConnection }: TcpRelayConfig) {
    this._logger = logger
    this._queueService = queueService
    this._encode = encode
    this._decode = decode
    this._lpsId = lpsId
    this._redisConnection = redisConnection ?? { host: 'localhost', port: 6379 }

    socket.on('data', async (data) => {
      try {
        this._logger.debug(`${this._lpsId} relay: Received buffer message`)
        const legacyMessage = this._decode(data)
        const lpsKey = this._lpsId + '-' + legacyMessage[41] + '-' + legacyMessage[42]
        this._logger.debug(this._lpsId + ' relay: Received message from: ' + this._lpsId + ' lpsKey: ' + lpsKey)
        this._logger.debug(this._lpsId + ' relay: Message converted to JSON: ' + JSON.stringify(legacyMessage))

        const messageType = this.getMessageType(legacyMessage[0])
        const lpsMessage = await LpsMessage.query().insertAndFetch({ lpsId: this._lpsId, lpsKey, type: messageType, content: legacyMessage })
        switch (messageType) {
          case LegacyMessageType.authorizationRequest:
            this._queueService.addToQueue('legacyAuthorizationRequests', await this.mapFromAuthorizationRequest(lpsMessage.id, legacyMessage))
            break
          case LegacyMessageType.financialRequest:
            this._queueService.addToQueue('legacyFinancialRequests', await this.mapFromFinancialRequest(lpsMessage.id, legacyMessage))
            break
          default:
            throw new Error(this._lpsId + 'relay: Cannot handle legacy message with mti: ' + messageType)
        }
      } catch (error) {
        this._logger.error(`${this._lpsId} relay: Failed to handle iso message.`)
        this._logger.error(error.message)
      }
    })

    socket.on('error', error => {
      this._logger.error(`${this._lpsId} relay: Error: ` + error.message)
    })
    this._socket = socket
  }

  async start (): Promise<void> {
    this._authorizationResponseWorker = new Worker(`${this._lpsId}AuthorizationResponses`, async (job: Job<LegacyAuthorizationResponse>) => {
      try {
        await this.handleAuthorizationResponse(job.data)
      } catch (error) {
        this._logger.error(`${this._lpsId} AuthorizationResponse worker: Failed to handle message. ${error.message}`)
      }
    }, { connection: this._redisConnection })

    this._financialResponseWorker = new Worker(`${this._lpsId}FinancialResponses`, async (job: Job<LegacyFinancialResponse>) => {
      try {
        await this.handleFinancialResponse(job.data)
      } catch (error) {
        this._logger.error(`${this._lpsId} FinancialResponse worker: Failed to handle message. ${error.message}`)
      }
    }, { connection: this._redisConnection })
  }

  async shutdown (): Promise<void> {
    this._logger.info(this._lpsId + ' relay: shutting down...')
    if (this._server) {
      this._server.close()
    }
    this._logger.debug(this._lpsId + ' relay: shutting down authorizationResponseWorker...')
    if (this._authorizationResponseWorker) {
      await this._authorizationResponseWorker.close()
    }
    this._logger.debug(this._lpsId + ' relay: shutting down financialResponseWorker...')
    if (this._financialResponseWorker) {
      await this._financialResponseWorker.close()
    }
  }

  async handleAuthorizationResponse (authorizationResponse: LegacyAuthorizationResponse): Promise<void> {
    if (!this._socket) {
      throw new Error(`${this._lpsId} relay: Cannot handleAuthorizationResponse as there is no socket registered.`)
    }

    const message = await this.mapToAuthorizationResponse(authorizationResponse)

    this._socket.write(this._encode(message))
  }

  async handleFinancialResponse (financialResponse: LegacyFinancialResponse): Promise<void> {
    if (!this._socket) {
      throw new Error(`${this._lpsId} relay: Cannot handleFinancialResponse as there is no socket registered.`)
    }

    const message = await this.mapToFinancialResponse(financialResponse)

    this._socket.write(this._encode(message))
  }

  getMessageType (mti: string): LegacyMessageType {
    switch (mti) {
      case '0100':
        return LegacyMessageType.authorizationRequest
      case '0200':
        return LegacyMessageType.financialRequest
      default:
        throw new Error(this._lpsId + 'relay: Cannot handle legacy message with mti: ' + mti)
    }
  }

  calculateFee (legacyMessage: LegacyMessage): Money {
    const amount = legacyMessage[28] ? new MlNumber(legacyMessage[28].slice(1)).divide(100).toString() : '0'
    return { amount, currency: this.getMojaloopCurrency(legacyMessage[49]) }
  }

  getMojaloopCurrency (legacyCurrency: string): string {
    return 'USD' // TODO: currency conversion from legacyMessage[49]
  }

  getTransactionType (legacyMessage: LegacyMessage): { initiatorType: 'DEVICE' | 'AGENT'; scenario: 'WITHDRAWAL' | 'REFUND' } {
    switch (legacyMessage[123].slice(-2)) {
      case '01': {
        return {
          initiatorType: 'AGENT',
          scenario: 'WITHDRAWAL'
        }
      }
      case '02': {
        return {
          initiatorType: 'DEVICE',
          scenario: 'WITHDRAWAL'
        }
      }
      default: {
        throw new Error('Legacy authorization request processing code not valid')
      }
    }
  }

  async mapFromAuthorizationRequest (lpsMessageId: string, legacyMessage: LegacyMessage): Promise<LegacyAuthorizationRequest> {
    // assuming local time
    const expirationDate = new Date()
    expirationDate.setMonth(Number(legacyMessage[7].slice(0, 2)) - 1, Number(legacyMessage[7].slice(2, 4)))
    expirationDate.setHours(Number(legacyMessage[7].slice(4, 6)) - 1, Number(legacyMessage[7].slice(6, 8)), Number(legacyMessage[7].slice(-2)))

    return {
      lpsId: this._lpsId,
      lpsKey: this._lpsId + '-' + legacyMessage[41] + '-' + legacyMessage[42],
      lpsAuthorizationRequestMessageId: lpsMessageId,
      amount: {
        amount: new MlNumber(legacyMessage[4]).divide(100).toString(),
        currency: this.getMojaloopCurrency(legacyMessage[49])
      },
      payee: {
        partyIdType: 'DEVICE',
        partyIdentifier: legacyMessage[41],
        partySubIdOrType: legacyMessage[42]
      },
      payer: {
        partyIdType: 'MSISDN',
        partyIdentifier: legacyMessage[102]
      },
      transactionType: this.getTransactionType(legacyMessage),
      expiration: expirationDate.toUTCString(),
      lpsFee: this.calculateFee(legacyMessage)
    }
  }

  async mapToAuthorizationResponse (authorizationResponse: LegacyAuthorizationResponse): Promise<LegacyMessage> {
    const authorizationRequest = await LpsMessage.query().where({ id: authorizationResponse.lpsAuthorizationRequestMessageId }).first().throwIfNotFound()

    return {
      ...authorizationRequest.content,
      0: '0110',
      30: 'D' + pad(new MlNumber(authorizationResponse.fees.amount).multiply(100).toString(), 8, '0'),
      39: '00',
      48: authorizationResponse.transferAmount.amount
    }
  }

  async mapFromFinancialRequest (lpsMessageId: string, legacyMessage: LegacyMessage): Promise<LegacyFinancialRequest> {
    return {
      lpsId: this._lpsId,
      lpsKey: this._lpsId + '-' + legacyMessage[41] + '-' + legacyMessage[42],
      lpsFinancialRequestMessageId: lpsMessageId,
      responseType: 'ENTERED',
      authenticationInfo: {
        authenticationType: 'OTP',
        authenticationValue: legacyMessage[103]
      }
    }
  }

  async mapToFinancialResponse (financialResponse: LegacyFinancialResponse): Promise<LegacyMessage> {
    const financialRequest = await LpsMessage.query().where({ id: financialResponse.lpsFinancialRequestMessageId }).first().throwIfNotFound()

    return {
      ...financialRequest.content,
      0: '0210',
      39: '00'
    }
  }
}
