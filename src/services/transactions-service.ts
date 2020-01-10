import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType, TransactionRequestsPostRequest } from '../types/mojaloop'
import { AxiosInstance } from 'axios'
const logger = require('@mojaloop/central-services-logger')

export enum TransactionState {
  transactionReceived = '01',
  transactionSent = '02',
  transactionResponded = '03',
  quoteReceived = '04',
  quoteResponded = '05',
  authRecieved = '06',
  authSent = '07',
  financialRequestReceived = '08',
  financialRequestSent = '09',
  transferReceived = '0A',
  fulfillmentSent = '0B',
  fulfillmentResponse = '0C',
  financialResponse = '0D'
}

export type DBTransactionParty = {
  fspId: string;
  transactionRequestId: string;
  type: string;
  identifierType: string;
  identifierValue: string;
  subIdorType: string;
}

export type DBTransaction = {
  transactionRequestId: string;
  transactionId?: string;
  lpsId: string;
  lpsKey: string;
  lpsFeeAmount: string;
  lpsFeeCurrency: string;
  state: string;
  amount: string;
  currency: string;
  expiration: string;
  initiator: string;
  initiatorType: string;
  scenario: string;
  originalTransactionId?: string;
  refundReason?: string;
}

export type TransactionRequest = {
  transactionRequestId: string; // UUID generated by the adaptor for the Mojaloop transactionRequest
  lpsId: string;
  lpsKey: string;
  payee: Party;
  payer: PartyIdInfo;
  lpsFee: Money;
  amount: Money;
  transactionType: TransactionType;
  authenticationType?: 'OTP' | 'QRCODE' | undefined;
  expiration?: string;
}

export type Transaction = {
  transactionRequestId: string; // UUID generated by the adaptor for the Mojaloop transactionRequest
  transactionId?: string; // UUID generated by the Payer FSP
  payee: Party;
  payer: PartyIdInfo;
  lpsId: string;
  lpsKey: string;
  lpsFee: Money;
  state: string;
  amount: Money;
  transactionType: TransactionType;
  authenticationType?: 'OTP' | 'QRCODE' | undefined;
  expiration?: string;
}

export type TransactactionParty = {
  fspId: string;
  transactionRequestId: string;
  type: string;
  identifier: string;
  subIDosType: string;
}
export interface TransactionsService {
  get (id: string, idType: 'transactionId' | 'transactionRequestId'): Promise<Transaction>;
  getByLpsKeyAndState(lpsKey: string, state: string): Promise<Transaction>;
  create (request: TransactionRequest): Promise<Transaction>;
  updatePayerFspId (id: string, idType: 'transactionId' | 'transactionRequestId', fspId: string): Promise<Transaction>;
  updateTransactionId (id: string, idType: 'transactionId' | 'transactionRequestId', fspId: string): Promise<Transaction>;
  updateState (id: string, idType: 'transactionId' | 'transactionRequestId', state: string): Promise<Transaction>;
  sendToMojaHub (request: TransactionRequest): Promise<void>;
  getByPayerMsisdn (msisdn: string): Promise<Transaction>;
}
export class KnexTransactionsService implements TransactionsService {
  constructor (private _knex: Knex, private _client: AxiosInstance) {
  }

  async get (id: string, idType: 'transactionId' | 'transactionRequestId'): Promise<Transaction> {
    const dbTransaction: DBTransaction | undefined = await this._knex<DBTransaction>('transactions').where(idType, id).first()
    if (!dbTransaction) {
      throw new Error('Error fetching transaction from database')
    }

    const dbPayee: DBTransactionParty | undefined = await this._knex<DBTransactionParty>('transactionParties').where('transactionRequestId', dbTransaction.transactionRequestId).where('type', 'payee').first()
    const dbPayer: DBTransactionParty | undefined = await this._knex<DBTransactionParty>('transactionParties').where('transactionRequestId', dbTransaction.transactionRequestId).where('type', 'payer').first()

    if (!dbPayee) {
      throw new Error('Error fetching transaction payee database')
    }
    if (!dbPayer) {
      throw new Error('Error fetching transaction party from database')
    }

    const transaction: Transaction = {
      transactionRequestId: dbTransaction.transactionRequestId,
      payer: {
        partyIdType: dbPayer.identifierType,
        partyIdentifier: dbPayer.identifierValue,
        fspId: dbPayer.fspId
      },
      payee: {
        partyIdInfo: {
          partyIdType: dbPayee.identifierType,
          partyIdentifier: dbPayee.identifierValue,
          partySubIdOrType: dbPayee.subIdorType,
          fspId: dbPayee.fspId
        }
      },
      transactionId: dbTransaction.transactionId,
      lpsId: dbTransaction.lpsId,
      lpsKey: dbTransaction.lpsKey,
      lpsFee: {
        amount: dbTransaction.lpsFeeAmount,
        currency: dbTransaction.lpsFeeCurrency
      },
      state: dbTransaction.state,
      amount: {
        amount: dbTransaction.amount,
        currency: dbTransaction.currency
      },
      transactionType: {
        initiator: dbTransaction.initiator,
        initiatorType: dbTransaction.initiatorType,
        scenario: dbTransaction.scenario
      },
      authenticationType: 'OTP',
      expiration: dbTransaction.expiration.toString()
    }

    if (dbTransaction.originalTransactionId) {
      transaction.transactionType.refundInfo = {
        originalTransactionId: dbTransaction.originalTransactionId,
        refundReason: dbTransaction.refundReason
      }
    }

    return transaction
  }

  async getByLpsKeyAndState (lpsKey: string, state: string): Promise<Transaction> {
    const dbTransaction: DBTransaction | undefined = await this._knex<DBTransaction>('transactions').where('state', state).where('lpsKey', lpsKey).orderBy('created_at', 'desc').first()
    if (!dbTransaction) {
      throw new Error('Error fetching transaction from database')
    }

    return this.get(dbTransaction.transactionRequestId, 'transactionRequestId')
  }

  async create (request: TransactionRequest): Promise<Transaction> {
    logger.debug('Transaction Requests Service: Creating transaction request ' + request.transactionRequestId)
    await this._knex<DBTransactionParty>('transactionParties').insert({
      transactionRequestId: request.transactionRequestId,
      type: 'payee',
      identifierType: request.payee.partyIdInfo.partyIdType,
      identifierValue: request.payee.partyIdInfo.partyIdentifier,
      fspId: request.payee.partyIdInfo.fspId,
      subIdorType: request.payee.partyIdInfo.partySubIdOrType

    }).then(result => result[0])

    await this._knex<DBTransactionParty>('transactionParties').insert({
      transactionRequestId: request.transactionRequestId,
      type: 'payer',
      identifierType: request.payer.partyIdType,
      identifierValue: request.payer.partyIdentifier,
      fspId: request.payer.fspId,
      subIdorType: request.payer.partySubIdOrType
    }).then(result => result[0])

    await this._knex<DBTransaction>('transactions').insert({
      transactionRequestId: request.transactionRequestId,
      lpsId: request.lpsId,
      lpsKey: request.lpsKey,
      lpsFeeAmount: request.lpsFee.amount,
      lpsFeeCurrency: request.lpsFee.currency,
      state: TransactionState.transactionReceived,
      amount: request.amount.amount,
      currency: request.amount.currency,
      expiration: request.expiration,
      initiator: request.transactionType.initiator,
      initiatorType: request.transactionType.initiatorType,
      scenario: request.transactionType.scenario,
      originalTransactionId: request.transactionType.refundInfo?.originalTransactionId,
      refundReason: request.transactionType.refundInfo?.refundReason
    }).then(result => result[0])

    return this.get(request.transactionRequestId, 'transactionRequestId')
  }

  async updatePayerFspId (id: string, idType: 'transactionId' | 'transactionRequestId', fspId: string): Promise<Transaction> {
    const dbTransaction = await this.get(id, idType)
    await this._knex('transactionParties').where('transactionRequestId', dbTransaction.transactionRequestId).where('type', 'payer').first().update('fspId', fspId)

    return this.get(id, idType)
  }

  async updateTransactionId (id: string, idType: 'transactionId' | 'transactionRequestId', transactionId: string): Promise<Transaction> {
    await this._knex('transactions').where(idType, id).first().update('transactionId', transactionId)

    return this.get(id, idType)
  }

  async updateState (id: string, idType: 'transactionId' | 'transactionRequestId', state: string): Promise<Transaction> {
    await this._knex('transactions').where(idType, id).first().update('state', state)

    return this.get(id, idType)
  }

  async sendToMojaHub (request: TransactionRequest): Promise<void> {
    // TODO: use mojaSDK
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      date: new Date().toUTCString(),
      'fspiop-source': 'adaptor',
      'fspiop-destination': request.payer.fspId
    }
    const transactionRequest: TransactionRequestsPostRequest = {
      amount: request.amount,
      payee: request.payee,
      payer: request.payer,
      transactionRequestId: request.transactionRequestId,
      transactionType: request.transactionType
    }
    await this._client.post('/transactionRequests', transactionRequest, { headers })
  }

  async getByPayerMsisdn (msisdn: string): Promise<Transaction> {
    const transaction = await this._knex('transactionParties').select('transactionParties.transactionRequestId').where('identifierValue', msisdn)
      .leftJoin('transactions', function () {
        this.on('transactions.transactionRequestId', '=', 'transactionParties.transactionRequestId')
      }).where('transactions.state', TransactionState.transactionReceived).orderBy('transactions.created_at', 'desc').first()

    if (!transaction) {
      throw new Error('No transaction found.')
    }

    return this.get(transaction.transactionRequestId, 'transactionRequestId')
  }
}
