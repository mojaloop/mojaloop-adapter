import Knex from 'knex'
import { Money } from '../types/mojaloop'
import { Logger } from 'adaptor'
const MojaloopSDK = require('@mojaloop/sdk-standard-components')

export enum TransferState {
  received = 'RECEIVED',
  reserved = 'RESERVED',
  committed = 'COMMITTED',
  aborted = 'ABORTED'
}

export type DBTransfer = {
  transferId: string;
  quoteId: string;
  transactionRequestId: string;
  fulfilment: string;
  transferState: string;
  amount: string;
  currency: string;
}

export type Transfer = {
  transferId: string;
  quoteId: string;
  transactionRequestId: string;
  fulfilment: string;
  transferState: string;
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
  logger: Logger;
}

export class KnexTransfersService implements TransfersService {
  private _knex: Knex
  private _logger: Logger = console
  private _ilp: IlpService
  constructor (options: TransferServiceOptions) {
    this._knex = options.knex
    this._logger = options.logger
    this._ilp = new MojaloopSDK.Ilp({ secret: options.ilpSecret, logger: this._logger })
  }

  async get (id: string): Promise<Transfer> {
    this._logger.debug('Transfers Service: getting Transfer ' + id)
    const dbTransfer: DBTransfer | undefined = await this._knex<DBTransfer>('transfers').where('transferId', id).first()
    if (!dbTransfer) {
      throw new Error('Error fetching transfer from database')
    }

    const transfer: Transfer = {
      transferId: dbTransfer.transferId,
      transactionRequestId: dbTransfer.transactionRequestId,
      amount: {
        amount: dbTransfer.amount,
        currency: dbTransfer.currency
      },
      quoteId: dbTransfer.quoteId,
      fulfilment: dbTransfer.fulfilment,
      transferState: dbTransfer.transferState
    }

    return transfer
  }

  async create (request: Transfer): Promise<Transfer> {
    this._logger.debug('Transfers Service: creating Transfer ' + request.transferId)
    await this._knex<DBTransfer>('transfers').insert({
      transferId: request.transferId,
      quoteId: request.quoteId,
      transactionRequestId: request.transactionRequestId,
      fulfilment: request.fulfilment,
      transferState: request.transferState,
      amount: request.amount.amount,
      currency: request.amount.currency
    }).then(result => result[0])

    return this.get(request.transferId)
  }

  async updateTransferState (data: Transfer): Promise<Transfer> {
    this._logger.debug('Transfer Service: updating Transfer State ' + data.transferId)
    await this._knex<DBTransfer>('transfers')
      .update('transferState', data.transferState)
      .where('transferId', data.transferId)
      .then(result => result)

    return this.get(data.transferId)
  }

  calculateFulfilment (ilpPacket: string): string {
    this._logger.debug('Transfer Service: calculating Fulfilment ' + ilpPacket)
    return this._ilp.caluclateFulfil(ilpPacket).replace('"', '')
  }

}
