import { Model } from 'objection'
import { Party } from '../types/mojaloop'

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

  toMojaloopParty (): Party {
    return {
      partyIdInfo: {
        partyIdType: this.identifierType,
        partyIdentifier: this.identifierValue,
        fspId: this.fspId,
        partySubIdOrType: this.subIdOrType
      }
    }
  }

}
