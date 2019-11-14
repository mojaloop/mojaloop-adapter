import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
export type TransactionRequest = {

  id: string;
  transactionId: string;
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
  update (id: string, request: { [k: string]: any }): Promise<TransactionRequest>;
  sendToMojaHub (request: TransactionRequest): Promise<void>;
}

export class KnexTransactionRequestService implements TransactionRequestService {
  constructor (private _knex: Knex, private _client: AxiosInstance) {
  }

  async getById (id: string): Promise<TransactionRequest> {
    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', id).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }

  async create (request: Partial<TransactionRequest>): Promise<TransactionRequest> {

    console.log('creating transaction request..................');

    // create payer in parties table
    const payee = await this._knex('transactionParties').insert({
      
      id : request.id ,
      transactionRequestId:request.transactionRequestId,
      type: 'payee',
      identifierType:request.identifierType,
      identifier:request.identifier,
      fspid:request.fspid,
      subIdorType:request.subIdorType,
      createdAt:request.createdAt,
      updatedAt:request.updatedAt

    }).then(result => result[0])

    const transactionRequesttopayee = await this._knex<TransactionRequest>('transactionParties').where('id', payee).first()
0
    console.log('transactionRequesttopayee')
    console.log(transactionRequesttopayee)

    const payer = await this._knex('transactionParties').insert({
      id : request.id ,
      transactionRequestId:request.transactionRequestId,
      type: 'payer',
      identifierType:request.identifierType,
      identifier:request.identifier,
      fspid:request.fspid,
      subIdorType:request.subIdorType,
      createdAt:request.createdAt,
      updatedAt:request.updatedAt      
    }).then(result => result[0])

    const transactionRequesttopayer = await this._knex<TransactionRequest>('transactionParties').where('id', payer).first()

    console.log('transactionRequesttopayer')
    console.log(transactionRequesttopayer)

    const insertedAccountId = await this._knex<TransactionRequest>('transactionRequests').insert({

      id:request.id,
      transactionId : request.transactionId,
      stan : request.stan,
      amount:request.amount,
      currency : request.currency,
      expiration:request.expiration,
      createdAt:request.createdAt,
      updatedAt:request.updatedAt
      
    }).then(result => result[0])


    const transactionRequest = await this._knex<TransactionRequest>('transactionRequests').where('id', insertedAccountId).first()

    if (!transactionRequest) {
      throw new Error('Error inserting transaction request into database')
    }

    return transactionRequest
  }

  async update (id: string, request: { [k: string]: any }): Promise<TransactionRequest> {
    // TODO: update transaction request

    const transactionRequest = this.getById(request.id!)

    return transactionRequest
  }

  async sendToMojaHub (request: TransactionRequest): Promise<void> {
    await this._client.post('/transactionRequests', request)
  }
}