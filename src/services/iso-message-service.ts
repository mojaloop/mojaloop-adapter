import { ISOMessage } from 'types/iso-messages'
import Knex = require('knex')

export interface IsoMessageService {
  create (transactionPK: string, lpsKey: string, switchKey: string, request: any): Promise <ISOMessage>;
  get(transactionPK: string, lpsKey: string, mti: string): Promise<ISOMessage>
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

async get (transactionPK: string, lpsKey: string, mti: string): Promise <ISOMessage> {
  
const isoMessage = await this._knex('isoMessages'). where('transactionPK', transactionPK). where('lpsKey', lpsKey).where ('mti', mti).first()



if(!isoMessage) {

  throw new Error('Cannot find iso message: transactionPK' + transactionPK + 'lpsKey'+ lpsKey +'mti'+ mti)
}


return { id: isoMessage.id, transactionPK, lpsKey, switchKey: isoMessage.switchKey, ...JSON.parse(isoMessage.content) }
  
  }
}
