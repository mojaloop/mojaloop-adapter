import Knex from 'knex'
import { Money } from '../types/mojaloop'
import { AxiosInstance } from 'axios'
const logger = require('@mojaloop/central-services-logger')
const MojaloopSDK = require('@mojaloop/sdk-standard-components')

export enum TransferState {
  'RECEIVED',
  'RESERVED',
  'COMMITTED',
  'ABORTED'
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
  sendFulfilment(data: Transfer, payerFspId: string): Promise<void>;
  calculateFulfilment (ilpPacket: string): string;
}

export class KnexTransfersService implements TransfersService {
  private _ilp: IlpService
  constructor (private _knex: Knex, private _client: AxiosInstance, _ilpSecret: string, private _logger?: any) {
    this._ilp = new MojaloopSDK.Ilp({ secret: _ilpSecret, logger: _logger })
  }

  async get (id: string): Promise<Transfer> {
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
    logger.debug('Transfers Service: Creating transfer ' + request.transferId)
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
    logger.debug('Transfer Service: Updating state of transfer ' + data.transferId)
    await this._knex<DBTransfer>('transfers')
      .update('transferState', data.transferState)
      .where('transferId', data.transferId)
      .then(result => result)

    return this.get(data.transferId)
  }

  async sendFulfilment (data: Transfer, payerFspId: string): Promise<void> {
    await this._client.put(`/transfers/${data.transferId}`, {
      fulfilment: data.fulfilment,
      completedTimestamp: new Date().toUTCString(),
      transferState: TransferState.RESERVED.toString()
    }, {
      headers: {
        'fspiop-source': process.env.ADAPTOR_FSP_ID || 'adaptor',
        'fspiop-destination': payerFspId,
        'content-type': 'application/vnd.interoperability.transfers+json;version=1.0',
        accept: 'application/vnd.interoperability.transfers+json;version=1.0',
        date: new Date().toUTCString()
      }
    })

  }

  calculateFulfilment (ilpPacket: string): string {
    return this._ilp.caluclateFulfil(ilpPacket).replace('"', '')
  }

}
