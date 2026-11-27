import { z } from 'zod';

export const packageCodeSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);
export const partyTypeCodeSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/);

const slugSchema = z.string().trim().toLowerCase().min(2).max(80).regex(
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  'Use lowercase letters, numbers, and hyphens',
);
const clockSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optionalEmailSchema = z.string().trim().max(200).refine(
  (value) => value === '' || z.email().safeParse(value).success,
  'Enter a valid email',
);

export const inclusionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export const createInclusionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});
export const updateInclusionSchema = createInclusionSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one field is required' },
);

export const partyTypeSchema = z.object({
  id: z.uuid(),
  code: partyTypeCodeSchema,
  title: z.string(),
  description: z.string(),
  sortOrder: z.number().int(),
  active: z.boolean(),
});
export const createPartyTypeSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});
export const updatePartyTypeSchema = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000),
  active: z.boolean(),
});

const packageFieldsSchema = z.object({
  description: z.string().trim().max(2000),
  pricePerPersonCents: z.number().int().nonnegative(),
  currency: z.string().trim().length(3).toUpperCase(),
  minGuests: z.number().int().min(1).max(500),
  maxGuests: z.number().int().min(1).max(500),
  durationMinutes: z.number().int().min(15).max(480),
  active: z.boolean(),
  inclusionIds: z.array(z.uuid()),
}).refine((value) => value.maxGuests >= value.minGuests, {
  message: 'Maximum guests must be at least the minimum',
});

export const packageTemplateSchema = packageFieldsSchema.extend({
  code: packageCodeSchema,
  name: z.string(),
  sortOrder: z.number().int(),
});
export const createPackageTemplateSchema = packageFieldsSchema.extend({
  name: z.string().trim().min(2).max(80),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});
export const updatePackageTemplateSchema = packageFieldsSchema.extend({
  name: z.string().trim().min(2).max(80),
});

export const venuePackageSchema = packageTemplateSchema.extend({
  id: z.uuid(),
  venueId: z.uuid(),
});
export const updateVenuePackageSchema = packageFieldsSchema;

export const venueSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  city: z.string(),
  mall: z.string(),
  address: z.string(),
  phone: z.string(),
  email: z.string(),
  description: z.string(),
  timezone: z.string(),
  active: z.boolean(),
  partyTypeIds: z.array(z.uuid()),
  packageCodes: z.array(packageCodeSchema),
  createdAt: z.iso.datetime(),
});
export const createVenueSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  city: z.string().trim().max(80).optional(),
  mall: z.string().trim().max(120).optional(),
  address: z.string().trim().max(300).optional(),
  phone: z.string().trim().max(30).optional(),
  email: optionalEmailSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  active: z.boolean().optional(),
  partyTypeIds: z.array(z.uuid()).min(1, 'Choose at least one party type'),
  packageCodes: z.array(packageCodeSchema).min(1, 'Choose at least one package'),
});
export const updateVenueSchema = createVenueSchema;

export const partyRoomSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  name: z.string(),
  capacity: z.number().int().positive(),
  active: z.boolean(),
});
export const createPartyRoomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  capacity: z.number().int().min(1).max(500),
  active: z.boolean().optional(),
});
export const updatePartyRoomSchema = createPartyRoomSchema;

export const venueHourSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  opensAt: clockSchema,
  closesAt: clockSchema,
  slotMinutes: z.number().int().min(15).max(240),
  active: z.boolean(),
}).refine((value) => !value.active || value.closesAt > value.opensAt, {
  message: 'Closing time must be after opening time',
});
export const replaceVenueHoursSchema = z.array(venueHourSchema).length(7).refine(
  (days) => new Set(days.map((day) => day.dayOfWeek)).size === 7,
  { message: 'Include each day of the week once' },
);

export const venueBlackoutSchema = z.object({
  id: z.uuid(),
  venueId: z.uuid(),
  blackoutDate: daySchema,
  reason: z.string(),
});
export const createVenueBlackoutSchema = z.object({
  blackoutDate: daySchema,
  reason: z.string().trim().max(200).optional(),
});

export const createPartyBookingSchema = z.object({
  venueId: z.uuid(),
  packageCode: packageCodeSchema,
  guestCount: z.number().int().min(1).max(500),
  startAt: z.iso.datetime(),
  partyRoomId: z.uuid().optional(),
  customerEmail: z.email().optional(),
});

export const partyStartClocks = ['11:00', '15:00', '19:00'] as const;

export const bookingRulesSchema = z.object({
  holdMinutes: z.number().int().min(1).max(120),
  minGuests: z.number().int().min(1).max(500),
  slotMinutes: z.number().int().min(15).max(240),
  refundPolicy: z.string().trim().max(4000),
});

export type PackageCode = z.infer<typeof packageCodeSchema>;
export type PartyTypeCode = z.infer<typeof partyTypeCodeSchema>;
export type Inclusion = z.infer<typeof inclusionSchema>;
export type CreateInclusion = z.infer<typeof createInclusionSchema>;
export type UpdateInclusion = z.infer<typeof updateInclusionSchema>;
export type PartyType = z.infer<typeof partyTypeSchema>;
export type CreatePartyType = z.infer<typeof createPartyTypeSchema>;
export type UpdatePartyType = z.infer<typeof updatePartyTypeSchema>;
export type PackageTemplate = z.infer<typeof packageTemplateSchema>;
export type CreatePackageTemplate = z.infer<typeof createPackageTemplateSchema>;
export type UpdatePackageTemplate = z.infer<typeof updatePackageTemplateSchema>;
export type VenuePackage = z.infer<typeof venuePackageSchema>;
export type UpdateVenuePackage = z.infer<typeof updateVenuePackageSchema>;
export type Venue = z.infer<typeof venueSchema>;
export type CreateVenue = z.infer<typeof createVenueSchema>;
export type UpdateVenue = z.infer<typeof updateVenueSchema>;
export type PartyRoom = z.infer<typeof partyRoomSchema>;
export type CreatePartyRoom = z.infer<typeof createPartyRoomSchema>;
export type UpdatePartyRoom = z.infer<typeof updatePartyRoomSchema>;
export type VenueHour = z.infer<typeof venueHourSchema>;
export type VenueBlackout = z.infer<typeof venueBlackoutSchema>;
export type CreatePartyBooking = z.infer<typeof createPartyBookingSchema>;
export type CreateVenueBlackout = z.infer<typeof createVenueBlackoutSchema>;
export type BookingRules = z.infer<typeof bookingRulesSchema>;
