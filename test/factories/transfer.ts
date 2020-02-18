import { Factory } from 'rosie'
import Faker from 'faker'
import { Transfer, TransferState } from '../../src/services/transfers-service'

export const TransferFactory = Factory.define<Transfer>('TransferFactory').attrs({
  amount: () => ({
    amount: Faker.random.number().toString(),
    currency: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3)
  }),
  transactionRequestId: () => Faker.random.uuid(),
  fulfillment: () => Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10),
  id: () => Faker.random.uuid(),
  quoteId: () => Faker.random.uuid(),
  state: TransferState.received
})
