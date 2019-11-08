import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
export type TransactionRequest = {
      id: string,
      transactionRequestId: string ,
      type: string ,
      identifierType: string ,
      identifier: string ,
      fspid: string ,
      subIdorType: string ,
      createdAt : number,
      updatedAt: number ,
}

export interface TransactionRequestService {
  getById (id: number): Promise<TransactionRequest>;
  create (request: Partial<TransactionRequest>): Promise<TransactionRequest>;
}

export class KnexTransactionRequestService implements TransactionRequestService {
  constructor (private _knex: Knex) {
  }

  async getById (id: number): Promise<TransactionRequest> {
    const transactionRequest = await this._knex<TransactionRequest>('transactionParties').where('id', id).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }

  async create (request: Partial<TransactionRequest>): Promise<TransactionRequest> {

    console.log('creating transaction request..................');

    const insertedAccountId = await this._knex<TransactionRequest>('transactionParties').insert({
      ...request,

      id: '1',
      transactionRequestId: '2' ,
      type: 'type' ,
      identifierType: 'identifierType' ,
      identifier: 'identifier' ,
      fspid: 'fspid' ,
      subIdorType: 'subIdorType' ,
      createdAt : 1,
      updatedAt: 1 

    }).then(result => result[0])
 
    const transactionRequest = await this._knex<TransactionRequest>('transactionParties').where('id', insertedAccountId).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }
    return transactionRequest
  }
  
}
