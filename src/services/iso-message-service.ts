import { ISOMessage } from 'types/iso-messages'
import Knex = require('knex')

export interface IsoMessageService {
  create (transactionPK: string, lpsKey: string, switchKey: string, request: any): Promise<ISOMessage>;
}

export class KnexIsoMessageService implements IsoMessageService {
  constructor (private _knex: Knex) {
  }

  async create (transactionPK: string, lpsKey: string, switchKey: string, request: any): Promise<ISOMessage> {

    const result = await this._knex('isoMessages').insert({
      transactionPK: transactionPK,
      switchKey: switchKey,
      mti: request[0],
      lpsKey: lpsKey,
      content: JSON.stringify(request)
    }).then(result => result[0])

    const isoMessage = await this._knex('isoMessages').where({ id: result }).first()

    return { id: isoMessage.id, transactionPK, lpsKey, switchKey, ...JSON.parse(isoMessage.content) }
  }

}
