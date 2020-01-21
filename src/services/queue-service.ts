import { Queue } from 'bullmq'

export interface QueueService {
    addToQueue(qName: string, payload: object): Promise<void>;
}

export class BullQueueService implements QueueService {
  private _queue: Queue
  constructor (queue: Queue) {
    this._queue = queue
  }

  async addToQueue (qName: string, payload: object): Promise<void> {
    this._queue.add(qName, payload)
  }
}
