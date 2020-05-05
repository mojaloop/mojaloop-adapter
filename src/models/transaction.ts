import { Model, RelationMappings, QueryBuilder } from 'objection'
import { TransactionFee } from './transactionFee'
import { TransactionParty } from './transactionParty'
import { LpsMessage } from './lpsMessage'
import { Quote } from './quote'
import { Transfers } from './transfer'

export enum TransactionState {
  transactionReceived = '01',
  transactionSent = '02',
  transactionResponded = '03',
  quoteReceived = '04',
  quoteResponded = '05',
  authReceived = '06',
  authSent = '07',
  financialRequestReceived = '08',
  financialRequestSent = '09',
  transferReceived = '0A',
  fulfillmentSent = '0B',
  fulfillmentResponse = '0C',
  financialResponse = '0D',
  transactionDeclined = '0E',
  transactionCancelled = '0F'
}

export class Transaction extends Model {

  transactionRequestId!: string
  lpsId!: string
  lpsKey!: string
  transactionId?: string
  originalTransactionId?: string
  amount!: string
  currency!: string
  scenario!: string
  initiatorType!: string
  initiator!: string
  expiration!: string
  state!: string
  previousState?: string
  authenticationType!: string

  fees?: TransactionFee[]
  payer?: TransactionParty
  payee?: TransactionParty
  lpsMessages?: LpsMessage[]
  quote?: Quote
  transfer?: Transfers

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
        relation: Model.HasOneRelation,
        modelClass: TransactionParty,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'transactionParties.transactionRequestId'
        },
        filter: { 'transactionParties.type': 'payer' }
      },
      payee: {
        relation: Model.HasOneRelation,
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
        relation: Model.HasOneRelation,
        modelClass: Quote,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'quotes.transactionRequestId'
        }
      },
      transfer: {
        relation: Model.HasOneRelation,
        modelClass: Transfers,
        join: {
          from: 'transactions.transactionRequestId',
          to: 'transfers.transactionRequestId'
        }
      }
    }
  }

  static modifiers = {
    incomplete (query: QueryBuilder<Transaction>, lpsKey: string): void {
      query.whereNot('state', TransactionState.transactionDeclined)
        .whereNot('state', TransactionState.transactionCancelled)
        .whereNot('state', TransactionState.financialResponse)
        .where('lpsKey', lpsKey)
    },
    payerMsisdn (query: QueryBuilder<Transaction>, msisdn: string): void {
      query.withGraphJoined('payer')
        .where('payer.identifierType', 'MSISDN')
        .where('payer.identifierValue', msisdn)
    },
    updateState (query: QueryBuilder<Transaction>, newState: string): void {
      query.onBuildKnex((knexBuilder) => {
        knexBuilder.update({
          previousState: Transaction.knex().ref('state'), // NB!: for MySQL order of update matters. make sure to update previousState first
          state: newState
        })
      })
    }
  }

  static createNotFoundError (): Error {
    return new Error('Transaction not found')
  }

  isValid (): boolean {
    return this.state !== TransactionState.transactionDeclined && this.state !== TransactionState.transactionCancelled && new Date(Date.now()) < new Date(this.expiration)
  }

  isRefund (): boolean {
    return !!this.originalTransactionId
  }
}
