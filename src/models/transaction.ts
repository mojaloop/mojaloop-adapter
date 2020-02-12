import { Model, RelationMappings, Pojo } from 'objection'
import { TransactionFee } from './transactionFee'
import { TransactionParty } from './transactionParty'
import { LpsMessage } from './lpsMessage'
import { Quote } from './quote'

export class Transaction extends Model {

  transactionRequestId!: string
  lpsId!: string
  lpsKey!: string
  transactionId?: string
  amount!: string
  currency!: string
  scenario!: string
  initiatorType!: string
  initiator!: string
  expiration!: string
  state!: string
  previousState?: string

  static get tableName (): string {
    return 'transactions'
  }

  static get idColumn (): string {
    return 'transactionRequestId'
  }

  static get relationMappings (): RelationMappings {
    return {
      fees: {
        relation: Model.HasManyRelation,
        modelClass: TransactionFee,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'transactionFees.transactionRequestId'
        }
      },
      payer: {
        relation: Model.HasManyRelation,
        modelClass: TransactionParty,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'transactionParties.transactionRequestId'
        },
        filter: { 'transactionParties.type': 'payer' }
      },
      payee: {
        relation: Model.HasManyRelation,
        modelClass: TransactionParty,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'transactionParties.transactionRequestId'
        },
        filter: { 'transactionParties.type': 'payee' }
      },
      lpsMessages: {
        relation: Model.ManyToManyRelation,
        modelClass: LpsMessage,
        join: {
          from: 'transactions.transactionRequestId',
          through: {
            from: 'transactionsLpsMessages.transactionRequestId',
            to: 'transactionsLpsMessages.lpsMessageId'
          },
          to: 'lpsMessages.id'
        }
      },
      quote: {
        relation: Model.HasManyRelation,
        modelClass: Quote,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'quotes.transactionRequestId'
        }
      }
    }
  }
}
