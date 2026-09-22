import { randomUUID } from 'node:crypto';
import { Consumer, Kafka, Producer } from 'kafkajs';
import {
  deadLetterEventSchema,
  eventPartitionKey,
  eventTypes,
} from '@arcade/contracts';

const MAX_ATTEMPTS = 3;
const GROUP_ID = 'arcade-catalog-v1';

export class KafkaAdapter {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private connected = false;
  constructor(clientId: string, brokers: string[]) {
    this.kafka = new Kafka({ clientId, brokers, retry: { retries: 5 } });
  }
  async connectProducer(): Promise<void> {
    if (this.producer) return;
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.connected = true;
  }
  async publish(topic: string, event: unknown, key = eventPartitionKey(event)): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer is not connected');
    await this.producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(event) }],
    });
  }
  async consume(topics: string[], handler: (value: unknown) => Promise<void>): Promise<void> {
    await this.connectProducer();
    this.consumer = this.kafka.consumer({ groupId: GROUP_ID });
    await this.consumer.connect();
    await this.consumer.subscribe({ topics, fromBeginning: false });
    this.connected = true;
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const raw = message.value.toString();
        let parsed: unknown = raw;
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          await this.publishDeadLetter(topic, partition, message.offset, raw, error, 1);
          return;
        }
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
          try {
            await handler(parsed);
            return;
          } catch (error) {
            if (attempt === MAX_ATTEMPTS) {
              await this.publishDeadLetter(topic, partition, message.offset, parsed, error, attempt);
            }
          }
        }
      },
    });
  }
  private async publishDeadLetter(
    originalTopic: string,
    originalPartition: number,
    originalOffset: string,
    originalEvent: unknown,
    error: unknown,
    attempts: number,
  ): Promise<void> {
    const correlationId = eventPartitionKey(originalEvent);
    const deadLetter = deadLetterEventSchema.parse({
      eventId: randomUUID(),
      eventType: eventTypes.deadLetter,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: correlationId === 'unknown' ? randomUUID() : correlationId,
      producer: GROUP_ID,
      payload: {
        originalTopic,
        originalPartition,
        originalOffset,
        attempts,
        error: error instanceof Error ? error.message : String(error),
        originalEvent,
      },
    });
    await this.publish(eventTypes.deadLetter, deadLetter, correlationId);
    console.error('Published dead-letter event', {
      originalTopic,
      originalOffset,
      attempts,
      error: deadLetter.payload.error,
    });
  }
  isReady(): boolean { return this.connected; }
  async close(): Promise<void> {
    await Promise.all([this.consumer?.disconnect(), this.producer?.disconnect()]);
    this.connected = false;
  }
}
