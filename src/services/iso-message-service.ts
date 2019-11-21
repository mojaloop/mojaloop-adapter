import { ISOMessage } from 'types/iso-messages'
import Knex = require('knex')

export interface IsoMessageService {
  create (request: Partial<ISOMessage>): Promise<ISOMessage>;
}

export class KnexIsoMessageService implements IsoMessageService {
  constructor (private _knex: Knex) {
  }

  async create (request: Partial<ISOMessage>): Promise<ISOMessage> {

    const result = await this._knex('isoMessages').insert({
      transactionPK: request.transactionPK,
      mti: request[0],
      content: JSON.stringify(request)
    }).then(result => result[0])

    const isoMessage = await this._knex('isoMessages').where({ id: result }).first()

    return { id: isoMessage.id, ...JSON.parse(isoMessage.content) }
  }

}
