import { Model } from 'objection'

export class TransactionFee extends Model {

  id!: string
  transactionRequestId!: string
  type!: string
  amount!: string
  currency!: string

  static get tableName (): string {
    return 'transactionFees'
  }

}
