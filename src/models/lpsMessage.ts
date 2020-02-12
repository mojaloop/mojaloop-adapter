import { Model } from 'objection'

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

}
