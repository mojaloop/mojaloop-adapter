import { Queue, ConnectionOptions } from 'bullmq'

export interface QueueService {
    addToQueue(name: string, payload: { [k: string]: any }): Promise<void>;
    shutdown (): Promise<void>;
}

export class BullQueueService implements QueueService {
  private _queues: Map<string, Queue> = new Map()

  constructor (queues: string[], redisConnection?: ConnectionOptions) {
    queues.forEach(name => {
      this._queues.set(name, new Queue(name, {
        connection: redisConnection ?? { host: 'localhost', port: 6379 }
      }))
    })
  }

  async getQueues (): Promise<Map<string, Queue>> {
    return this._queues
  }

  async addToQueue (name: string, payload: { [k: string]: any }): Promise<void> {
    const queue = this._queues.get(name)
    if (queue) { queue.add(name, payload) } else { throw new Error(`Cannot find queue with name: ${name}`) }
  }

  async shutdown (): Promise<void> {
    await Promise.all(Array.from(this._queues.values()).map(queue => queue.close()))
    this._queues.clear()
  }

}
