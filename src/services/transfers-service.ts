import Knex from 'knex'
import { Money } from '../types/mojaloop'
import { Logger } from '../adaptor'
const MojaloopSDK = require('@mojaloop/sdk-standard-components')

export enum TransferState {
  received = 'RECEIVED',
  reserved = 'RESERVED',
  committed = 'COMMITTED',
  aborted = 'ABORTED'
}

export type DBTransfer = {
  id: string;
  quoteId: string;
  transactionRequestId: string;
  fulfillment: string;
  state: string;
  amount: string;
  currency: string;
}

export type Transfer = {
  id: string;
  quoteId: string;
  transactionRequestId: string;
  fulfillment: string;
  state: string;
  amount: Money;
}

interface IlpService {
  caluclateFulfil (ilpPacket: string): string;
}

export interface TransfersService {
  get(id: string): Promise<Transfer>;
  create(request: Transfer): Promise<Transfer>;
  updateTransferState(data: Transfer): Promise<Transfer>;
  calculateFulfilment (ilpPacket: string): string;
}

export type TransferServiceOptions = {
  knex: Knex;
  ilpSecret: string;
  logger?: Logger;
}

export class KnexTransfersService implements TransfersService {
  private _knex: Knex
  private _logger: Logger
  private _ilp: IlpService
  constructor (options: TransferServiceOptions) {
    this._knex = options.knex
    this._logger = options.logger || console
    this._ilp = new MojaloopSDK.Ilp({ secret: options.ilpSecret, logger: this._logger })
  }

  async get (id: string): Promise<Transfer> {
    this._logger.debug('Transfers Service: getting Transfer ' + id)
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
      state: dbTransfer.state
    }

    return transfer
  }

  async create (request: Transfer): Promise<Transfer> {
    this._logger.debug('Transfers Service: creating Transfer ' + request.id)
    await this._knex<DBTransfer>('transfers').insert({
      id: request.id,
      quoteId: request.quoteId,
      transactionRequestId: request.transactionRequestId,
      fulfillment: request.fulfillment,
      state: request.state,
      amount: request.amount.amount,
      currency: request.amount.currency
    }).then(result => result[0])

    return this.get(request.id)
  }

  async updateTransferState (data: Transfer): Promise<Transfer> {
    this._logger.debug('Transfer Service: updating Transfer State ' + data.id)
    await this._knex<DBTransfer>('transfers')
      .update('state', data.state)
      .where('id', data.id)
      .then(result => result)

    return this.get(data.id)
  }

  calculateFulfilment (ilpPacket: string): string {
    this._logger.debug('Transfer Service: calculating Fulfilment ' + ilpPacket)
    return this._ilp.caluclateFulfil(ilpPacket).replace('"', '')
  }

}
