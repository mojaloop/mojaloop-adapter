import Knex from 'knex'
import { Party, PartyIdInfo, Money, TransactionType } from '../types/mojaloop'
import { AxiosInstance } from 'axios'
const logger = require('@mojaloop/central-services-logger')

export type DBTransfer = {
  id: string;
  quoteId: string;
  transactionRequestId: string;
  fulfillment: string;
  transferState: string;
  amount: string;
  currency: string;
}

export type TransferRequest = {
  id: string;
  quoteId: string;
  transactionRequestId: string;
  fulfillment: string;
  transferState: string;
  amount: Money;
}

export type Transfer = {
  id: string;
  quoteId: string;
  transactionRequestId: string;
  fulfillment: string;
  transferState: string;
  amount: Money;
}

export interface TransfersService {
  get(id: string): Promise<Transfer>;
  create(request: TransferRequest): Promise<Transfer>;
}

export class KnexTransfersService implements TransfersService {
  constructor(private _knex: Knex, private _client: AxiosInstance) {
  }

  async get(id: string): Promise<Transfer> {
    const dbTransfer: DBTransfer | undefined = await this._knex<DBTransfer>('transfers').where('id', id).first()
    if (!dbTransfer) {
      throw new Error('Error fetching transfer from database')
    }

    const transfer: Transfer = {
      id: dbTransfer.id,
      transactionRequestId: dbTransfer.transactionRequestId,
      amount: {
        amount: dbTransfer.amount,
        currency: dbTransfer.currency
      },
      quoteId: dbTransfer.quoteId,
      fulfillment: dbTransfer.fulfillment,
      transferState: dbTransfer.transferState,
    }

    return transfer
  }

  async create(request: TransferRequest): Promise<Transfer> {
    logger.debug('Transfer Requests Service: Creating transfer request ' + request.id)
    await this._knex<DBTransfer>('transfers').insert({
      id: request.id,
      quoteId: request.quoteId,
      transactionRequestId: request.transactionRequestId,
      fulfillment: request.fulfillment,
      transferState: request.transferState,
      amount: request.amount.amount,
      currency: request.amount.currency,
    }).then(result => result[0])

    return this.get(request.id)
  }

}

// next steps: writing tests
            // adding more methods
            // adding complexity to properties