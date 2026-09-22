import { Consumer, Kafka, Producer } from 'kafkajs';

export class KafkaAdapter {
  private readonly kafka: Kafka;
  private producer?: Producer;
  private consumer?: Consumer;
  private connected = false;
  constructor(clientId: string, brokers: string[]) {
    this.kafka = new Kafka({ clientId, brokers, retry: { retries: 5 } });
  }
  async connectProducer(): Promise<void> {
    this.producer = this.kafka.producer();
    await this.producer.connect();
    this.connected = true;
  }
  async publish(topic: string, event: unknown): Promise<void> {
    if (!this.producer) throw new Error('Kafka producer is not connected');
    await this.producer.send({ topic, messages: [{ value: JSON.stringify(event) }] });
  }
  async consume(topics: string[], handler: (value: unknown) => Promise<void>): Promise<void> {
    this.consumer = this.kafka.consumer({ groupId: 'arcade-payment-v1' });
    await this.consumer.connect();
    await this.consumer.subscribe({ topics, fromBeginning: false });
    this.connected = true;
    await this.consumer.run({ eachMessage: async ({ message }) => {
      if (!message.value) return;
      await handler(JSON.parse(message.value.toString()));
    }});
  }
  isReady(): boolean { return this.connected; }
  async close(): Promise<void> {
    await Promise.all([this.consumer?.disconnect(), this.producer?.disconnect()]);
    this.connected = false;
  }
}

