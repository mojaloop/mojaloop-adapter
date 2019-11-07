import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
export type TransactionRequest = {

  //  id: string;
  // payee: string;
  // payer: string;
  // amount: string;
  // transactionType: string;
  // authenticationType?: 'OTP' | 'QRCODE' | undefined;
  // expiration?: string;

      id: string,
      transactionId: string ,
      stan: string ,
      amount: string ,
      currency: string ,
      expiration: number ,
      createdAt: number ,
      updatedAt: number 


}

export interface TransactionRequestService {
  getById (id: number): Promise<TransactionRequest>;
  create (request: Partial<TransactionRequest>): Promise<TransactionRequest>;
}

export class KnexTransactionRequestService implements TransactionRequestService {
  constructor (private _knex: Knex) {
  }

  async getById (id: number): Promise<TransactionRequest> {
    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', id).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }

  async create (request: Partial<TransactionRequest>): Promise<TransactionRequest> {

    console.log('creating transaction request..................');

    const insertedAccountId = await this._knex<TransactionRequest>('transactionRequests').insert({
      ...request,

      id: '1',
      transactionId: '456' ,
      stan: '123456' ,
      amount: '200' ,
      currency: 'INR' ,
      expiration: 1 ,
      createdAt: 1 ,
      updatedAt: 1 

    }).then(result => result[0])
  //   .then(result => console.log(result))

  // console.log(this._knex.select().table('transactionRequests'));
    //console.log('insertdata' + insertdata )
    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', insertedAccountId).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }
    return transactionRequest
  }
  
}
