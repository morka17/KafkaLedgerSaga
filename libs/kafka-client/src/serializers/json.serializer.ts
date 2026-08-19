/**
 * JSON codec used to (de)serialize envelope payloads on the wire.
 *
 * Swappable for an Avro codec backed by Confluent Schema Registry in
 * environments that need strict schema evolution guarantees - the
 * KafkaProducerService and consumer decorators only depend on this
 * interface, not on JSON specifically.
 */
export interface MessageCodec {
    encode(value: unknown): Buffer;
    decode<T = unknown>(buffer: Buffer | string): T;
  }
  
  export class JsonCodec implements MessageCodec {
    encode(value: unknown): Buffer {
      return Buffer.from(JSON.stringify(value));
    }
  
    decode<T = unknown>(buffer: Buffer | string): T {
      const raw = Buffer.isBuffer(buffer) ? buffer.toString('utf-8') : buffer;
      return JSON.parse(raw) as T;
    }
  }
  
  export const defaultCodec = new JsonCodec();
  