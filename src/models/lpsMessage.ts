import { Model, RelationMappings } from 'objection'
import { Transaction } from './transaction'

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
  transactions?: Transaction[]
  static get tableName (): string {
    return 'lpsMessages'
  }

  static get jsonAttributes (): string[] {
    return ['content']
  }

  static createNotFoundError (): Error {
    return new Error('LPS Message not found')
  }

  static get relationMappings (): RelationMappings {
    return {
      transactions: {
        relation: Model.ManyToManyRelation,
        modelClass: Transaction,
        join: {
          from: 'lpsMessages.id',
          through: {
            from: 'transactionsLpsMessages.lpsMessageId',
            to: 'transactionsLpsMessages.transactionRequestId'
          },
          to: 'transactions.transactionRequestId'
        }
      }
    }
  }
}
