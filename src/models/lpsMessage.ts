import { Model } from 'objection'

export enum LegacyMessageType {
  authorizationRequest = 'authorizationRequest',
  authorizationResponse = 'authorizationRespone',
  financialRequest = 'financialRequest',
  financialResponse = 'financialResponse',
  reversalRequest = 'reversalRequest',
  reversalResponse = 'reversalResponse'
}

export class LpsMessage extends Model {

  id!: string
  lpsId!: string
  lpsKey!: string
  type!: string
  content!: { [k: string]: any }
  static get tableName (): string {
    return 'lpsMessages'
  }

  static get jsonAttributes (): string[] {
    return ['content']
  }

  static createNotFoundError (): Error {
    return new Error('LPS Message not found')
  }

}
