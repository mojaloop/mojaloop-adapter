import { Model } from 'objection'

export class TransactionParty extends Model {

  id!: string
  type!: string
  identifierType!: string
  identifierValue!: string
  fspId?: string
  subIdOrType?: string

  static get tableName (): string {
    return 'transactionParties'
  }

}
