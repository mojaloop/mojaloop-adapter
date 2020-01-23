import { Queue } from 'bullmq'

export interface QueueService {
    addToQueue(qName: string, payload: any): Promise<void>;
}

export class BullQueueService implements QueueService {
  private _queue: Map<string, Queue> = new Map()

  constructor (queue: string[]) {
    for (const i in queue) {
      this._queue.set(queue[i], new Queue(queue[i]))
    }
  }

  async getQueue (): Promise<Map<string, Queue>> {
    return this._queue
  }

  async addToQueue (queueName: string, payload: any): Promise<void> {
    const queue = this._queue.get(queueName)
    if (queue) { queue.add(queueName, payload) } else { throw new Error(`Cannot find queue with name: ${queueName}`) }
  }

  async shutdown (): Promise<void> {
    this._queue.forEach(queue => {
      queue.close()
    })
    this._queue.clear()
  }

}
