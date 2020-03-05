import { Model, RelationMappings } from 'objection'
import { Transaction } from './transaction'

export class Quote extends Model {

  id!: string
  transactionRequestId!: string
  transactionId?: string
  amount!: string
  amountCurrency!: string
  feeAmount!: string
  feeCurrency!: string
  commissionAmount?: string
  commissionCurrency?: string
  transferAmount!: string
  transferAmountCurrency!: string
  ilpPacket!: string
  condition!: string
  expiration!: string

  static get tableName (): string {
    return 'quotes'
  }

  static get relationMappings (): RelationMappings {
    return {
      transaction: {
        relation: Model.BelongsToOneRelation,
        modelClass: Transaction,
        join: {
          from: 'quotes.transactionRequestId',
          to: 'transaction.transactionRequestId'
        }
      }
    }
  }

  static createNotFoundError (): Error {
    return new Error('Quote not found')
  }

  isExpired (): boolean {
    return new Date(this.expiration) <= new Date(Date.now())
  }

}
