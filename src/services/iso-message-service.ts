import { ISOMessage } from 'types/iso-messages'
import Knex = require('knex')

export interface IsoMessageService {
  create (transactionRequestId: string, lpsKey: string, lpsId: string, message: any): Promise <ISOMessage>;
  get(transactionRequestId: string, lpsKey: string, mti: string): Promise<ISOMessage>;
}

export class KnexIsoMessageService implements IsoMessageService {
  constructor (private _knex: Knex) {
  }

  async create (transactionRequestId: string, lpsKey: string, lpsId: string, message: any): Promise<ISOMessage> {
    const result = await this._knex('isoMessages').insert({
      transactionRequestId,
      lpsId,
      lpsKey,
      mti: message[0],
      content: JSON.stringify(message)
    }).then(result => result[0])

    const isoMessage = await this._knex('isoMessages').where({ id: result }).first()

    return { id: isoMessage.id, transactionRequestId, lpsKey, lpsId, ...JSON.parse(isoMessage.content) }
  }

  async get (transactionRequestId: string, lpsKey: string, mti: string): Promise <ISOMessage> {
    const isoMessage = await this._knex('isoMessages').where('transactionRequestId', transactionRequestId).where('lpsKey', lpsKey).where('mti', mti).first()

    if (!isoMessage) {
      throw new Error('Cannot find iso message: transactionRequestId' + transactionRequestId + ' lpsKey:' + lpsKey + ' mti' + mti)
    }

    return { id: isoMessage.id, transactionRequestId, lpsKey, lpsId: isoMessage.lpsId, ...JSON.parse(isoMessage.content) }
  }
}
