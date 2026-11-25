import { z } from 'zod';

export const eventTypes = {
  bookingCreated: 'arcade.booking.created.v1',
  bookingConfirmed: 'arcade.booking.confirmed.v1',
  bookingPaymentFailed: 'arcade.booking.payment-failed.v1',
  inventoryReserved: 'arcade.inventory.reserved.v1',
  inventoryRejected: 'arcade.inventory.rejected.v1',
  inventoryReleased: 'arcade.inventory.released.v1',
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
  systemAdmin: z.boolean().optional(),
  active: z.boolean().optional(),
});
export const updateUserGroupSchema = z
  .object({
    name: z.string().trim().min(2).max(64).optional(),
    systemAdmin: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const groupMembershipSchema = z.object({
  groupId: z.uuid(),
  userId: z.uuid(),
});
export const setUserGroupSchema = z.object({
  groupId: z.uuid(),
});
export const registerUserSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(72),
  displayName: z.string().trim().min(1).max(100),
});
export const createUserAdminSchema = registerUserSchema.extend({
  active: z.boolean().optional(),
});
export const updateUserSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional(),
    active: z.boolean().optional(),
    password: z.string().min(8).max(72).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const userIdParamSchema = z.object({ id: z.uuid() });
export const userGroupIdParamSchema = z.object({ groupId: z.uuid() });
export const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  roles: z.array(userRoleSchema),
  active: z.boolean(),
  groupId: z.uuid().nullable(),
  groupName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export const userGroupSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  systemAdmin: z.boolean(),
  active: z.boolean(),
  members: z.array(z.uuid()),
});

const menuUrlSchema = z.string().trim().min(1).max(255).regex(/^\//, 'URL must start with /');
export const menuActionsSchema = z.object({
  canAll: z.boolean(),
  canAdd: z.boolean(),
  canDelete: z.boolean(),
  canEdit: z.boolean(),
  canDetails: z.boolean(),
});
export const menuSchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  label: z.string(),
  icon: z.string(),
  url: z.string(),
  priority: z.number().int(),
  active: z.boolean(),
  expandable: z.boolean(),
  sysAdmin: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const createMenuSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  label: z.string().trim().min(1).max(100),
  icon: z.string().trim().min(1).max(64),
  url: menuUrlSchema,
  priority: z.number().int().min(0).max(9999),
  active: z.boolean().optional(),
  expandable: z.boolean().optional(),
  sysAdmin: z.boolean().optional(),
});
export const updateMenuSchema = z.object({
  parentId: z.uuid().nullable().optional(),
  label: z.string().trim().min(1).max(100).optional(),
  icon: z.string().trim().min(1).max(64).optional(),
  url: menuUrlSchema.optional(),
  priority: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
  expandable: z.boolean().optional(),
  sysAdmin: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const menuIdParamSchema = z.object({ id: z.uuid() });
export const menuAccessSchema = menuSchema.extend({
  canAll: z.boolean(),
  canAdd: z.boolean(),
  canDelete: z.boolean(),
  canEdit: z.boolean(),
  canDetails: z.boolean(),
});
export const menuRightSchema = z.object({
  menuId: z.uuid(),
  role: userRoleSchema,
  canAll: z.boolean(),
  canAdd: z.boolean(),
  canDelete: z.boolean(),
  canEdit: z.boolean(),
  canDetails: z.boolean(),
});
export const menuRightsQuerySchema = z.object({ role: userRoleSchema });
export const replaceMenuRightsSchema = z.object({
  role: userRoleSchema,
  rights: z.array(z.object({
    menuId: z.uuid(),
    canAll: z.boolean(),
    canAdd: z.boolean(),
    canDelete: z.boolean(),
    canEdit: z.boolean(),
    canDetails: z.boolean(),
  })),
});

export const machineSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
});
export const updateMachineSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const catalogMachineSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  pricePerHourCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).nullable(),
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
export const slotAvailabilitySchema = z.object({
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  available: z.boolean(),
});

export const bookingStatusSchema = z.enum([
  'PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'CANCELLED',
]);
export const createBookingSchema = z.object({
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  customerEmail: z.email().optional(),
});
export const updateBookingSchema = z.object({
  machineId: z.uuid().optional(),
  startAt: z.iso.datetime().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export const bookingSchema = createBookingSchema.extend({
  id: z.uuid(),
  userId: z.uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  status: bookingStatusSchema,
  createdAt: z.iso.datetime(),
});

export const paymentProviderSchema = z.enum(['SIMULATED', 'RAZORPAY']);
export const paymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED']);
export const createPaymentSchema = z.object({
  bookingId: z.uuid(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(8).max(255),
  simulateOutcome: z.enum(['SUCCEED', 'FAIL']).default('SUCCEED'),
});
export const createPaymentOrderSchema = z.object({
  bookingId: z.uuid(),
});
export const simulatePaymentSchema = z.object({
  outcome: z.enum(['SUCCEED', 'FAIL']).default('SUCCEED'),
});
export const confirmRazorpayPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().min(1),
});
export const checkoutOrderSchema = z.object({
  bookingId: z.uuid(),
  orderId: z.string().min(1),
  keyId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  provider: paymentProviderSchema,
  alreadyPaid: z.boolean().optional(),
});
export const paymentSchema = z.object({
  id: z.uuid(),
  bookingId: z.uuid(),
  userId: z.uuid().optional(),
  customerEmail: z.email().optional(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string().min(8).max(255),
  status: paymentStatusSchema,
  provider: paymentProviderSchema,
});

export const bookingCreatedPayloadSchema = bookingSchema.pick({
  id: true, userId: true, machineId: true, startAt: true,
  durationMinutes: true, amountCents: true, currency: true,
}).extend({
  customerEmail: z.email().optional(),
});
export const paymentEventPayloadSchema = paymentSchema.pick({
  id: true, bookingId: true, amountCents: true, currency: true, status: true,
}).extend({
  customerEmail: z.email().optional(),
});
export const inventoryEventPayloadSchema = z.object({
  bookingId: z.uuid(),
  userId: z.uuid().optional(),
  customerEmail: z.email().optional(),
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  reason: z.string().optional(),
});
export const notificationDeliverySchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  eventType: z.string(),
  channel: z.string(),
  recipient: z.string(),
  status: z.enum(['SENT', 'FAILED', 'RECORDED']),
  payload: z.unknown(),
  createdAt: z.iso.datetime().optional(),
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
export const inventoryReleasedPayloadSchema = z.object({
  bookingId: z.uuid(),
  machineId: z.uuid(),
  startAt: z.iso.datetime(),
  durationMinutes: z.number().int().positive(),
  reason: z.string().optional(),
});
export const inventoryReleasedEventSchema = createEventEnvelopeSchema(
  eventTypes.inventoryReleased, inventoryReleasedPayloadSchema,
);

export type RegisterUser = z.infer<typeof registerUserSchema>;
export type Login = z.infer<typeof loginSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type UserGroup = z.infer<typeof userGroupSchema>;
export type Menu = z.infer<typeof menuSchema>;
export type MenuActions = z.infer<typeof menuActionsSchema>;
export type MenuAccess = z.infer<typeof menuAccessSchema>;
export type MenuRight = z.infer<typeof menuRightSchema>;
export type CreateMenu = z.infer<typeof createMenuSchema>;
export type UpdateMenu = z.infer<typeof updateMenuSchema>;
export type ReplaceMenuRights = z.infer<typeof replaceMenuRightsSchema>;
export type Machine = z.infer<typeof machineSchema>;
export type UpdateMachine = z.infer<typeof updateMachineSchema>;
export type CatalogMachine = z.infer<typeof catalogMachineSchema>;
export type Game = z.infer<typeof gameSchema>;
export type Pricing = z.infer<typeof pricingSchema>;
export type MachineQuote = z.infer<typeof machineQuoteSchema>;
export type SlotAvailability = z.infer<typeof slotAvailabilitySchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type CreateBookingRequest = z.infer<typeof createBookingSchema>;
export type UpdateBooking = z.infer<typeof updateBookingSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;
export type CreatePaymentOrderRequest = z.infer<typeof createPaymentOrderSchema>;
export type SimulatePaymentRequest = z.infer<typeof simulatePaymentSchema>;
export type ConfirmRazorpayPaymentRequest = z.infer<typeof confirmRazorpayPaymentSchema>;
export type CheckoutOrder = z.infer<typeof checkoutOrderSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type NotificationDelivery = z.infer<typeof notificationDeliverySchema>;

export * from './parties';
