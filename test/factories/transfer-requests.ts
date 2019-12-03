import { Factory } from 'rosie'
import Faker from 'faker'
import { TransferRequest } from '../../src/services/transfers-service'

export const TransferRequestFactory = Factory.define<TransferRequest>('TransferRequestFactory').attrs({
  amount: { 
    amount: Faker.random.number().toString(), 
    currency: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 3),
  },
  transactionRequestId: () => Faker.random.uuid(),
  fulfillment: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10),
  id: () => Faker.random.uuid(),
  quoteId: () => Faker.random.uuid(),
  transferState: Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 10),
})
