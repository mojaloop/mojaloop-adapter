import { BullQueueService } from '../../src/services/queue-service'
import { QuotesPostRequestFactory } from '../factories/mojaloop-messages'

describe('queueService', function () {

  const queueName1 = 'queue1'
  const queueName2 = 'queue2'
  const queueService = new BullQueueService([queueName1, queueName2])

  afterAll(async () => {
    await queueService.shutdown()
  })

  test('can create queues mapped to the keys provided', async () => {
    const queue = await queueService.getQueues()
    const queue1 = queue.has(queueName1)
    const queue2 = queue.has(queueName2)
    const queueSize = queue.size

    expect(queue1).toBeTruthy()
    expect(queue2).toBeTruthy()
    expect(queueSize).toEqual(2)
  })
  test('throws error if trying to add to a queue that does not exist', async () => {
    const queueName = 'someName'
    let errorMessage = ''

    const quoteRequest = QuotesPostRequestFactory.build()
    const headers = {
      'fspiop-source': 'payer',
      'fspiop-destination': 'payee'
    }

    const quotesObject = {
      payload: quoteRequest,
      headers: headers
    }

    try {
      await queueService.addToQueue(queueName, quotesObject)
    } catch (error) {
      errorMessage = error.message
    }

    expect(errorMessage).toBe(`Cannot find queue with name: ${queueName}`)
  })
})
