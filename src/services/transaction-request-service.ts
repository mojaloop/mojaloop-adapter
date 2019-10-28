import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
export type TransactionRequest = {
  id: string;
  payee: Party;
  payer: PartyIdInfo;
  amount: Money;
  transactionType: TransactionType;
  authenticationType?: 'OTP' | 'QRCODE' | undefined;
  expiration?: string;
}

export interface TransactionRequestService {
  getById (id: string): Promise<TransactionRequest>;
  create (request: Partial<TransactionRequest>): Promise<TransactionRequest>;
}

export class KnexTransactionRequestService implements TransactionRequestService {
  constructor (private _knex: Knex) {
  }

  async getById (id: string): Promise<TransactionRequest> {
    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', id).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }

  async create (request: Partial<TransactionRequest>): Promise<TransactionRequest> {
    const insertedAccountId = await this._knex<TransactionRequest>('transactionRequests').insert({
      ...request
    }).then(result => result[0])

    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', insertedAccountId).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }
}
