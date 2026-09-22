import { z } from 'zod';

export const eventTypes = {
  bookingCreated: 'arcade.booking.created.v1',
  bookingConfirmed: 'arcade.booking.confirmed.v1',
  bookingPaymentFailed: 'arcade.booking.payment-failed.v1',
  inventoryReserved: 'arcade.inventory.reserved.v1',
  inventoryRejected: 'arcade.inventory.rejected.v1',
  paymentCompleted: 'arcade.payment.completed.v1',
  paymentFailed: 'arcade.payment.failed.v1',
  deadLetter: 'arcade.dead-letter.v1',
} as const;

export const eventTypeSchema = z.enum(Object.values(eventTypes));

export const eventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: eventTypeSchema,
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid(),
  producer: z.string().min(1),
  payload: z.unknown(),
});

export const createEventEnvelopeSchema = <T extends z.ZodType>(
  eventType: z.infer<typeof eventTypeSchema>,
  payload: T,
) => eventEnvelopeSchema.extend({
  eventType: z.literal(eventType),
  payload,
});

export type EventEnvelope<T = unknown> = Omit<z.infer<typeof eventEnvelopeSchema>, 'payload'> & {
  payload: T;
};

/** Same booking stays on one Kafka partition so its saga events stay ordered. */
export function eventPartitionKey(event: unknown): string {
  if (!event || typeof event !== 'object') return 'unknown';
  const envelope = event as {
    eventId?: unknown;
    payload?: { bookingId?: unknown; id?: unknown };
  };
  const payload = envelope.payload;
  const bookingId = payload && typeof payload === 'object'
    ? payload.bookingId ?? payload.id
    : undefined;
  if (typeof bookingId === 'string' && bookingId.length > 0) return bookingId;
  if (typeof envelope.eventId === 'string' && envelope.eventId.length > 0) return envelope.eventId;
  return 'unknown';
}

export const deadLetterEventSchema = z.object({
  eventId: z.uuid(),
  eventType: z.literal(eventTypes.deadLetter),
  version: z.literal(1),
  occurredAt: z.iso.datetime(),
  correlationId: z.string().min(1),
  producer: z.string().min(1),
  payload: z.object({
    originalTopic: z.string().min(1),
    originalPartition: z.number().int().nonnegative(),
    originalOffset: z.string().min(1),
    attempts: z.number().int().positive(),
    error: z.string().min(1),
    originalEvent: z.unknown(),
  }),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export const apiSuccessSchema = <T extends z.ZodType>(data: T) => z.object({
  success: z.literal(true),
  data,
});

export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = z.infer<typeof apiErrorSchema>;

export const userRoleSchema = z.enum(['CUSTOMER', 'STAFF', 'ADMIN']);
export const createUserGroupSchema = z.object({
  name: z.string().trim().min(2).max(64),
});
export const groupMembershipSchema = z.object({
  groupId: z.uuid(),
  userId: z.uuid(),
});
export const registerUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(100),
});
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  roles: z.array(userRoleSchema),
  createdAt: z.iso.datetime(),
});
export const userGroupSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  members: z.array(z.uuid()),
});

export const machineSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
});
export const gameSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  machineId: z.uuid(),
});
export const pricingSchema = z.object({
  machineId: z.uuid(),
  pricePerHourCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export const machineQuoteSchema = z.object({
  machineId: z.uuid(),
  durationMinutes: z.number().int().min(15).max(480),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
});

export const bookingStatusSchema = z.enum([
  'PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED',
]);
export const createBookingSchema = z.object({
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(480),
});
export const bookingSchema = createBookingSchema.extend({
  id: z.uuid(),
  userId: z.uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  status: bookingStatusSchema,
  createdAt: z.iso.datetime(),
});

export const createPaymentSchema = z.object({
  bookingId: z.uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(8).max(255),
  simulateOutcome: z.enum(['SUCCEED', 'FAIL']).default('SUCCEED'),
});
export const paymentSchema = createPaymentSchema.omit({ simulateOutcome: true }).extend({
  id: z.uuid(),
  status: z.enum(['COMPLETED', 'FAILED']),
  provider: z.literal('SIMULATED'),
});

export const bookingCreatedPayloadSchema = bookingSchema.pick({
  id: true, userId: true, machineId: true, startAt: true,
  durationMinutes: true, amountCents: true, currency: true,
});
export const paymentEventPayloadSchema = paymentSchema.pick({
  id: true, bookingId: true, amountCents: true, currency: true, status: true,
});
export const inventoryEventPayloadSchema = z.object({
  bookingId: z.uuid(),
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  reason: z.string().optional(),
});
export const bookingCreatedEventSchema = createEventEnvelopeSchema(
  eventTypes.bookingCreated, bookingCreatedPayloadSchema,
);
export const paymentCompletedEventSchema = createEventEnvelopeSchema(
  eventTypes.paymentCompleted, paymentEventPayloadSchema,
);
export const paymentFailedEventSchema = createEventEnvelopeSchema(
  eventTypes.paymentFailed, paymentEventPayloadSchema,
);
export const inventoryReservedEventSchema = createEventEnvelopeSchema(
  eventTypes.inventoryReserved, inventoryEventPayloadSchema,
);
export const inventoryRejectedEventSchema = createEventEnvelopeSchema(
  eventTypes.inventoryRejected, inventoryEventPayloadSchema,
);

export type RegisterUser = z.infer<typeof registerUserSchema>;
export type Login = z.infer<typeof loginSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type UserGroup = z.infer<typeof userGroupSchema>;
export type Machine = z.infer<typeof machineSchema>;
export type Game = z.infer<typeof gameSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type MachineQuote = z.infer<typeof machineQuoteSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;
export type Payment = z.infer<typeof paymentSchema>;
