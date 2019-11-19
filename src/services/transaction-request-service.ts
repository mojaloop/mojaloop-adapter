import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
import { AxiosInstance } from 'axios'
const uuidv4 = require('uuid/v4')
const logger = require('@mojaloop/central-services-logger')
export type DBTransactionParty = {
  fspid: string;
  transactionRequestId: string;
  type: string;
  identifierType: string;
  identifier: string;
  subIdorType: string;
}

export type DBTransactionRequest = {
  id: string;
  transactionId: string;
  stan: string;
  amount: string;
  currency: string;
  expiration: string;
}

export type TransactionRequest = {
  id?: string;
  transactionId?: string;
  stan: string;
  payee: Party;
  payer: PartyIdInfo;
  amount: Money;
  transactionType: TransactionType;
  authenticationType?: 'OTP' | 'QRCODE' | undefined;
  expiration?: string;
}

export type TransactactionParty = {
  fspid: string;
  transactionRequestId: string;
  type: string;
  identifier: string;
  subIDosType: string;
}
export interface TransactionRequestService {
  getById (id: string): Promise<TransactionRequest>;
  create (request: Partial<TransactionRequest>): Promise<TransactionRequest>;
  updatePayerFspId(id: string, fspId: string): Promise<TransactionRequest>;
  updateTransactionId(id: string, fspId: string): Promise<TransactionRequest>;
  sendToMojaHub (request: TransactionRequest): Promise<void>;
}
export class KnexTransactionRequestService implements TransactionRequestService {
  constructor (private _knex: Knex, private _client: AxiosInstance) {
  }

  async getById (id: string): Promise<TransactionRequest> {
    const transactionRequestFromPartyPayee: DBTransactionParty | undefined = await this._knex<DBTransactionParty>('transactionParties').where('transactionRequestId', id).where('type', 'payee').first()
    const transactionRequestFromPartyPayer: DBTransactionParty | undefined = await this._knex<DBTransactionParty>('transactionParties').where('transactionRequestId', id).where('type', 'payer').first()
    const transactionRequestResponse: DBTransactionRequest | undefined = await this._knex<DBTransactionRequest>('transactionRequests').where('id', id).first()

    if (!transactionRequestResponse) {
      throw new Error('Error fetching transaction request from database')
    }
    if (!transactionRequestFromPartyPayee) {
      throw new Error('Error fetching transaction request payee database')
    }
    if (!transactionRequestFromPartyPayer) {
      throw new Error('Error fetching transaction request party from database')
    }

    const transactionRequest: TransactionRequest = {
      payer: {
        partyIdType: transactionRequestFromPartyPayer.identifierType,
        partyIdentifier: transactionRequestFromPartyPayer.identifier,
        fspId: transactionRequestFromPartyPayer.fspid
      },
      payee: {
        partyIdInfo: {
          partyIdType: transactionRequestFromPartyPayee.identifierType,
          partyIdentifier: transactionRequestFromPartyPayee.identifier,
          partySubIdOrType: transactionRequestFromPartyPayee.subIdorType
        }
      },
      stan: transactionRequestResponse.stan,
      transactionId: transactionRequestResponse.transactionId,
      amount: {
        amount: transactionRequestResponse.amount,
        currency: transactionRequestResponse.currency
      },
      transactionType: {
        initiator: 'PAYEE',
        initiatorType: 'DEVICE',
        scenario: 'WITHDRAWAL'
      },
      authenticationType: 'OTP',
      expiration: transactionRequestResponse.expiration.toString()
    }

    return transactionRequest
  }

  async create (request: TransactionRequest): Promise<TransactionRequest> {

    const transactionRequestId = uuidv4()
    logger.debug('Transaction Requests Service: Creating transaction request ' + transactionRequestId)
    await this._knex<DBTransactionParty>('transactionParties').insert({
      transactionRequestId: transactionRequestId,
      type: 'payee',
      identifierType: request.payee.partyIdInfo.partyIdType,
      identifier: request.payee.partyIdInfo.partyIdentifier,
      fspid: request.payee.partyIdInfo.fspId,
      subIdorType: request.payee.partyIdInfo.partySubIdOrType

    }).then(result => result[0])

    await this._knex<DBTransactionParty>('transactionParties').insert({
      transactionRequestId: transactionRequestId,
      type: 'payer',
      identifierType: request.payer.partyIdType,
      identifier: request.payer.partyIdentifier,
      fspid: request.payer.fspId,
      subIdorType: request.payer.partySubIdOrType
    }).then(result => result[0])

    await this._knex<DBTransactionRequest>('transactionRequests').insert({
      id: transactionRequestId,
      transactionId: 'null',
      stan: request.stan,
      amount: request.amount.amount,
      currency: request.amount.currency,
      expiration: request.expiration
    }).then(result => result[0])

    const transactionRequest: TransactionRequest = Object.assign({}, request)
    transactionRequest.id = transactionRequestId

    return transactionRequest
  }

  async updatePayerFspId (id: string, fspId: string): Promise<TransactionRequest> {

    const insertedAccountId = await this._knex('transactionParties').where('transactionRequestId', id).where('type', 'payer').first().update('fspid', fspId)
    const transactionRequestResponse = this.getById(id)

    if (!insertedAccountId) {
      throw new Error('Error inserting transaction request into database')
    }

    if (!transactionRequestResponse) {
      throw new Error('Error Updating transaction request into database')
    }
    return transactionRequestResponse
  }

  async updateTransactionId (id: string, transactionId: string): Promise<TransactionRequest> {
    const insertedAccountId = await this._knex('transactionRequests').where('id', id).first().update('transactionId', transactionId)
    const transactionRequestResponse = this.getById(id)

    if (!insertedAccountId) {
      throw new Error('Error inserting transaction request into database')
    }

    if (!transactionRequestResponse) {
      throw new Error('Error Updating transaction request into database')
    }

    return transactionRequestResponse
  }

  async sendToMojaHub (request: TransactionRequest): Promise<void> {
    await this._client.post('/transactionRequests', request)
  }
}
