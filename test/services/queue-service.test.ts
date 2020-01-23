import { BullQueueService } from '../../src/services/queue-service'

describe('queueService', function () {

  const queueName1 = 'queue1'
  const queueName2 = 'queue2'
  const queueService = new BullQueueService([queueName1, queueName2])

  afterAll(async () => {
    await queueService.shutdown()
  })

  test('can create queues mapped to the keys provided', async () => {
    const queue = await queueService.getQueue()
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

    try {
      await queueService.addToQueue(queueName, 'payload')
    } catch (error) {
      errorMessage = error.message
    }

    expect(errorMessage).toBe(`Cannot find queue with name: ${queueName}`)
  })
})
