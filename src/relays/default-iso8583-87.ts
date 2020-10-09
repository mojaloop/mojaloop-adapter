import { raw } from 'objection'
import { LegacyAuthorizationRequest, LegacyAuthorizationResponse, LegacyFinancialRequest, LegacyFinancialResponse, LegacyReversalRequest, ResponseType, LegacyReversalResponse } from '../types/adaptor-relay-messages'
import { LpsMessage, LegacyMessageType } from '../models'
import { Money } from '@mojaloop/sdk-standard-components'
import { pad } from '../utils/util'
import { LegacyMessage } from '../types/tcpRelay'
import { BaseTcpRelay } from './base-tcp-relay'
const MlNumber = require('@mojaloop/ml-number')

export class DefaultIso8583_87TcpRelay extends BaseTcpRelay {

  getLpsKey(legacyMessage: LegacyMessage): string {
    return this._lpsId + '-' + legacyMessage[41] + '-' + legacyMessage[42]
  }

  async handleAuthorizationResponse (authorizationResponse: LegacyAuthorizationResponse): Promise<void> {
    const message = await this.mapToAuthorizationResponse(authorizationResponse)

    this._socket.write(this._encode(message))
  }

  async handleFinancialResponse (financialResponse: LegacyFinancialResponse): Promise<void> {
    const message = await this.mapToFinancialResponse(financialResponse)

    this._socket.write(this._encode(message))
  }

  async handleReversalResponse (reversalResponse: LegacyReversalResponse): Promise<void> {
    const message = await this.mapToReversalAdviceResponse(reversalResponse)

    this._socket.write(this._encode(message))
  }

  getMessageType (mti: string): LegacyMessageType {
    switch (mti) {
      case '0100':
        return LegacyMessageType.authorizationRequest
      case '0200':
        return LegacyMessageType.financialRequest
      case '0420':
        return LegacyMessageType.reversalRequest
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

  getResponseCode (response: ResponseType): string {
    switch (response) {
      case ResponseType.approved:
        return this._responseCodes.approved
      case ResponseType.invalid:
        return this._responseCodes.invalidTransaction
      case ResponseType.noPayerFound:
        return this._responseCodes.noIssuer
      case ResponseType.payerFSPRejected:
        return this._responseCodes.doNotHonour
      default:
        throw new Error(`${this._lpsId} relay: Cannot map to a response code.`)
    }
  }

  async mapFromAuthorizationRequest (lpsMessageId: string, legacyMessage: LegacyMessage): Promise<LegacyAuthorizationRequest> {
    this._logger.debug(`${this._lpsId} relay: Mapping from authorization request`)

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
      expiration: new Date(Date.now() + this._transactionExpiryWindow * 1000).toUTCString(),
      lpsFee: this.calculateFee(legacyMessage)
    }
  }

  async mapToAuthorizationResponse (authorizationResponse: LegacyAuthorizationResponse): Promise<LegacyMessage> {
    this._logger.debug(`${this._lpsId} relay: Mapping to authorization response`)
    const authorizationRequest = await LpsMessage.query().where({ id: authorizationResponse.lpsAuthorizationRequestMessageId }).first().throwIfNotFound()

    if (authorizationResponse.response === ResponseType.approved) {
      console.log('Testing87')
      const approvalMessage: LegacyMessage = { ...authorizationRequest.content, 0: '0110', 39: this._responseCodes.approved }
      if (authorizationResponse.fees) approvalMessage[30] = 'D' + pad(new MlNumber(authorizationResponse.fees.amount).multiply(100).toString(), 8, '0')
      if (authorizationResponse.transferAmount) approvalMessage[48] = authorizationResponse.transferAmount.amount

      return approvalMessage
    } else {
      return {
        ...authorizationRequest.content,
        0: '0110',
        39: this._responseCodes.invalidTransaction
      }
    }
  }

  async mapFromFinancialRequest (lpsMessageId: string, legacyMessage: LegacyMessage): Promise<LegacyFinancialRequest> {
    this._logger.debug(`${this._lpsId} relay: Mapping from financial request`)
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
    this._logger.debug(`${this._lpsId} relay: Mapping to financial request`)
    const financialRequest = await LpsMessage.query().where({ id: financialResponse.lpsFinancialRequestMessageId }).first().throwIfNotFound()
    console.log('Testing0210')
    return {
      ...financialRequest.content,
      0: '0210',
      39: this.getResponseCode(financialResponse.response)
    }
  }

  async mapFromReversalAdvice (lpsMessageId: string, legacyMessage: LegacyMessage): Promise<LegacyReversalRequest> {
    this._logger.debug(`${this._lpsId} relay: Mapping from reversal advice`)

    const originalDataElements = String(legacyMessage[90])
    const mti = originalDataElements.slice(0, 4)
    const stan = originalDataElements.slice(4, 10)
    const date = originalDataElements.slice(10, 20)
    const acquiringId = originalDataElements.slice(20, 31).replace(/^0+/g, '')
    const forwardingId = originalDataElements.slice(31, 42).replace(/^0+/g, '')

    this._logger.debug(JSON.stringify({ originalDataElements, stan, mti, date, acquiringId, forwardingId }))

    const query = LpsMessage.query()
      .where(raw(`JSON_EXTRACT(content, '$."0"') = "${mti}"`))
      .where(raw(`JSON_EXTRACT(content, '$."7"') = "${date}"`))
      .where(raw(`JSON_EXTRACT(content, '$."11"') = "${stan}"`))
    if (acquiringId !== '') query.where(raw(`JSON_EXTRACT(content, '$."32"') = "${acquiringId}"`))
    if (forwardingId !== '') query.where(raw(`JSON_EXTRACT(content, '$."33"') = "${forwardingId}"`))

    const prevLpsMessageId = await query.orderBy('created_at', 'desc').first().throwIfNotFound()

    this._logger.debug(`${this._lpsId} relay: Found previous lps message: id: ${prevLpsMessageId.id} content: ${JSON.stringify(prevLpsMessageId.content)}`)

    return {
      lpsId: this._lpsId,
      lpsKey: this._lpsId + '-' + legacyMessage[41] + '-' + legacyMessage[42],
      lpsFinancialRequestMessageId: prevLpsMessageId.id,
      lpsReversalRequestMessageId: lpsMessageId
    }
  }

  async mapToReversalAdviceResponse (reversalResponse: LegacyReversalResponse): Promise<LegacyMessage> {
    this._logger.debug(`${this._lpsId} relay: Mapping to reversal response`)
    const reversalRequest = await LpsMessage.query().where({ id: reversalResponse.lpsReversalRequestMessageId }).first().throwIfNotFound()

    return {
      ...reversalRequest.content,
      0: '0430',
      39: this.getResponseCode(reversalResponse.response)
    }
  }
}
