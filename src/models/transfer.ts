import { Model, RelationMappings } from 'objection'
import { Transaction } from './transaction'

export class Transfers extends Model {

  id!: string
  transactionRequestId!: string
  quoteId?: string
  fulfillment!: string
  state!: string
  amount!: string
  currency!: string

  static get tableName (): string {
    return 'transfers'
  }

  static get relationMappings (): RelationMappings {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'transfers.transactionRequestId',
          to: 'transaction.transactionRequestId'
        }
      }
    }
  }

}
