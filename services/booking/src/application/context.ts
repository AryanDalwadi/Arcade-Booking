import { randomBytes, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {
  bookingCreatedEventSchema,
  createBookingSchema,
  createPartyBookingSchema,
  updateBookingSchema,
  eventTypes,
  inventoryRejectedEventSchema,
  inventoryReleasedEventSchema,
  inventoryReservedEventSchema,
  partyStartClocks,
  paymentCompletedEventSchema,
  paymentFailedEventSchema,
} from '@arcade/contracts';
import { readAuthContext, requireAuth } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';
import { RedisAdapter } from '../adapters/redis';
import type { PartyCatalog, QuoteProvider } from '../adapters/catalog';
import type { SlotAvailability } from '../adapters/inventory';
import { HOLD_TTL_SECONDS, bookingHoldKeys } from './holds';

export async function handleBookingEvent(db: Postgres, event: unknown): Promise<void> {
  const eventType = (event as { eventType?: string })?.eventType;
  if (eventType === eventTypes.paymentCompleted || eventType === eventTypes.paymentFailed) {
    const parsed = eventType === eventTypes.paymentCompleted
      ? paymentCompletedEventSchema.parse(event)
      : paymentFailedEventSchema.parse(event);
    const paymentStatus = eventType === eventTypes.paymentCompleted ? 'COMPLETED' : 'FAILED';
    await db.query(
      `UPDATE bookings
       SET payment_status=$2,
           status=CASE
             WHEN $2='FAILED' THEN 'PAYMENT_FAILED'
             WHEN status IN ('PAYMENT_FAILED', 'CANCELLED') THEN status
             ELSE 'CONFIRMED'
           END
       WHERE id=$1`,
      [parsed.payload.bookingId, paymentStatus],
    );
    return;
  }
  if (eventType === eventTypes.inventoryReleased) {
    const parsed = inventoryReleasedEventSchema.parse(event);
    await db.query(
      `UPDATE bookings
       SET inventory_status='RELEASED',
           status=CASE WHEN status='CONFIRMED' THEN status ELSE 'PAYMENT_FAILED' END
       WHERE id=$1`,
      [parsed.payload.bookingId],
    );
    return;
  }
  if (eventType === eventTypes.inventoryReserved || eventType === eventTypes.inventoryRejected) {
    const parsed = eventType === eventTypes.inventoryReserved
      ? inventoryReservedEventSchema.parse(event)
      : inventoryRejectedEventSchema.parse(event);
    const inventoryStatus = eventType === eventTypes.inventoryReserved ? 'RESERVED' : 'REJECTED';
    await db.query(
      `UPDATE bookings
       SET inventory_status=$2,
           status=CASE
             WHEN $2='REJECTED' THEN 'CANCELLED'
             WHEN payment_status='COMPLETED' THEN 'CONFIRMED'
             ELSE status
           END
       WHERE id=$1`,
      [parsed.payload.bookingId, inventoryStatus],
    );
  }
}

const activeHoldSql = `status NOT IN ('CANCELLED', 'PAYMENT_FAILED')
  AND (status <> 'PENDING_PAYMENT' OR COALESCE(hold_expires_at, created_at + interval '10 minutes') > now())`;

export async function expireHeldBookings(db: Postgres): Promise<number> {
  const expired = await db.query(
    `UPDATE bookings
     SET status='PAYMENT_FAILED', payment_status='FAILED'
     WHERE status='PENDING_PAYMENT'
       AND COALESCE(hold_expires_at, created_at + interval '10 minutes') <= now()`,
  );
  await db.query(`DELETE FROM party_holds WHERE booking_id IS NULL AND expires_at <= now()`);
  return expired.rowCount ?? 0;
}

export function bookingRoutes(
  db: Postgres,
  redis: RedisAdapter,
  quotes: QuoteProvider,
  inventory: SlotAvailability,
  parties?: PartyCatalog,
): Router {
  const router = Router();
  router.post('/bookings', requireAuth, async (req, res) => {
    if (req.body && typeof req.body === 'object' && 'venueId' in req.body && req.body.venueId) {
      await bookParty(req, res);
      return;
    }
    const auth = readAuthContext(req)!;
    const input = createBookingSchema.parse(req.body);
    const requestedUserId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    const userId = staff && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedUserId)
      ? requestedUserId
      : auth.subject;
    const customerEmail = auth.email ?? input.customerEmail;
    let quote;
    try {
      quote = await quotes.quote(input.machineId, input.durationMinutes);
    } catch {
      return res.status(422).json({
        success: false,
        message: 'The selected machine cannot be priced for this booking',
        code: 'BOOKING_QUOTE_UNAVAILABLE',
      });
    }
    let available: boolean;
    try {
      available = await inventory.available(input.machineId, input.startAt, input.durationMinutes);
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Could not confirm machine availability',
        code: 'BOOKING_SLOT_CHECK_UNAVAILABLE',
      });
    }
    if (!available) {
      return res.status(409).json({
        success: false,
        message: 'This machine is already booked for that time',
        code: 'BOOKING_SLOT_UNAVAILABLE',
      });
    }
    const holdKeys = bookingHoldKeys(input.machineId, input.startAt, input.durationMinutes);
    const holdOwner = randomUUID();
    if (!(await redis.acquire(holdKeys, holdOwner, HOLD_TTL_SECONDS))) {
      return res.status(409).json({
        success: false,
        message: 'This machine and time slot is currently being booked',
        code: 'BOOKING_HOLD_EXISTS',
      });
    }
    try {
      const booking = await db.transaction(async (client) => {
        const result = await client.query(
          `INSERT INTO bookings(user_id,machine_id,start_at,duration_minutes,amount_cents,currency,status,hold_expires_at)
           VALUES($1,$2,$3,$4,$5,$6,'PENDING_PAYMENT', now() + make_interval(mins => $7::integer)) RETURNING *`,
          [userId,input.machineId,input.startAt,input.durationMinutes,quote.amountCents,quote.currency, await holdMinutes(parties)],
        );
        const row = result.rows[0];
        const event = bookingCreatedEventSchema.parse({
          eventId: randomUUID(), eventType: eventTypes.bookingCreated, version: 1,
          occurredAt: new Date().toISOString(), correlationId: randomUUID(), producer: 'booking',
          payload: {
            id: row.id,
            userId: row.user_id,
            machineId: row.machine_id,
            startAt: new Date(row.start_at).toISOString(),
            durationMinutes: row.duration_minutes,
            amountCents: row.amount_cents,
            currency: row.currency,
            ...(customerEmail ? { customerEmail } : {}),
          },
        });
        await client.query('INSERT INTO outbox(event_id,topic,payload) VALUES($1,$2,$3)', [event.eventId, event.eventType, event]);
        return row;
      });
      return res.status(201).json({ success: true, data: booking });
    } finally {
      await redis.delete(holdKeys);
    }
  });
  router.patch('/bookings/:id', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const input = updateBookingSchema.parse(req.body);
    const found = await db.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    const row = found.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking not found', code: 'BOOKING_NOT_FOUND' });
    }
    if (!canManageBooking(auth.roles, auth.subject, row.user_id)) {
      return res.status(403).json({ success: false, message: 'You can only change your own booking', code: 'BOOKING_FORBIDDEN' });
    }
    if (row.venue_id) {
      return res.status(409).json({
        success: false,
        message: 'Party bookings stay as booked',
        code: 'BOOKING_LOCKED',
      });
    }
    if (!editableStatus(row.status)) {
      return res.status(409).json({
        success: false,
        message: 'Only unpaid bookings can be edited',
        code: 'BOOKING_LOCKED',
      });
    }
    const machineId = input.machineId ?? row.machine_id;
    const startAt = input.startAt ?? new Date(row.start_at).toISOString();
    const durationMinutes = input.durationMinutes ?? Number(row.duration_minutes);
    let quote;
    try {
      quote = await quotes.quote(machineId, durationMinutes);
    } catch {
      return res.status(422).json({
        success: false,
        message: 'The selected machine cannot be priced for this booking',
        code: 'BOOKING_QUOTE_UNAVAILABLE',
      });
    }
    let available: boolean;
    try {
      available = await inventory.available(machineId, startAt, durationMinutes);
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Could not confirm machine availability',
        code: 'BOOKING_SLOT_CHECK_UNAVAILABLE',
      });
    }
    if (!available) {
      return res.status(409).json({
        success: false,
        message: 'This machine is already booked for that time',
        code: 'BOOKING_SLOT_UNAVAILABLE',
      });
    }
    const updated = await db.query(
      `UPDATE bookings
       SET machine_id=$2, start_at=$3, duration_minutes=$4, amount_cents=$5, currency=$6
       WHERE id=$1 RETURNING *`,
      [row.id, machineId, startAt, durationMinutes, quote.amountCents, quote.currency],
    );
    return res.json({ success: true, data: updated.rows[0] });
  });
  router.delete('/bookings/:id', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const found = await db.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    const row = found.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking not found', code: 'BOOKING_NOT_FOUND' });
    }
    if (!canManageBooking(auth.roles, auth.subject, row.user_id)) {
      return res.status(403).json({ success: false, message: 'You can only change your own booking', code: 'BOOKING_FORBIDDEN' });
    }
    if (row.status === 'CONFIRMED') {
      const cancelled = await db.query(
        `UPDATE bookings SET status='CANCELLED' WHERE id=$1 RETURNING *`,
        [row.id],
      );
      return res.json({ success: true, data: cancelled.rows[0] });
    }
    await db.query('DELETE FROM bookings WHERE id=$1', [row.id]);
    return res.status(204).send();
  });
  router.get('/bookings/:id', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const found = await db.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    const row = found.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking not found', code: 'BOOKING_NOT_FOUND' });
    }
    const staff = auth.roles.has('ADMIN') || auth.roles.has('STAFF');
    if (!staff && row.user_id !== auth.subject) {
      return res.status(403).json({ success: false, message: 'You can only view your own booking', code: 'BOOKING_FORBIDDEN' });
    }
    return res.json({ success: true, data: row });
  });
  router.get('/party-slots', async (req, res) => {
    const venueId = z.string().uuid().safeParse(req.query.venueId);
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.date);
    if (!venueId.success || !date.success || !parties) {
      res.status(400).json({ success: false, message: 'Choose a venue and a date', code: 'VALIDATION_ERROR' });
      return;
    }
    let venue;
    try {
      venue = await parties.venue(venueId.data);
    } catch {
      res.status(404).json({ success: false, message: 'That venue was not found', code: 'VENUE_UNAVAILABLE' });
      return;
    }
    const zone = venue.timezone || 'Asia/Kolkata';
    const slots = [];
    for (const clock of partyStartClocks) {
      const start = zonedStart(date.data, clock, zone);
      const rows = (await db.query(
        `SELECT status FROM bookings
         WHERE venue_id=$1
           AND ${activeHoldSql}
           AND start_at <= $2::timestamptz
           AND start_at + (duration_minutes * interval '1 minute') > $2::timestamptz`,
        [venueId.data, start],
      )).rows as Array<{ status: string }>;
      const held = await db.query(
        `SELECT id FROM party_holds
         WHERE venue_id=$1
           AND booking_id IS NULL
           AND expires_at > now()
           AND start_at <= $2::timestamptz
           AND start_at + (duration_minutes * interval '1 minute') > $2::timestamptz
         LIMIT 1`,
        [venueId.data, start],
      );
      const state = rows.some((row) => row.status === 'CONFIRMED')
        ? 'booked'
        : rows.length > 0 || held.rows.length > 0
          ? 'held'
          : 'open';
      slots.push({ clock, state });
    }
    res.json({ success: true, data: { slots } });
  });
  router.get('/bookings', requireAuth, async (req, res) => {
    const auth = readAuthContext(req)!;
    const userId = auth.subject;
    const roles = auth.roles;
    const canReadAll = roles.has('ADMIN') || roles.has('STAFF');
    const requestedUserId = canReadAll && req.query.userId ? String(req.query.userId) : userId;
    const values = canReadAll && !req.query.userId ? [] : [requestedUserId];
    const sql = values.length
      ? 'SELECT * FROM bookings WHERE user_id=$1 ORDER BY created_at DESC'
      : 'SELECT * FROM bookings ORDER BY created_at DESC';
    res.json({ success: true, data: (await db.query(sql, values)).rows });
  });
  router.post('/party-holds', async (req, res) => {
    await createPartyHold(req, res);
  });
  router.post('/party-holds/:id/release', async (req, res) => {
    await releasePartyHold(req, res);
  });
  router.post('/party-holds/:id/claim', requireAuth, async (req, res) => {
    await claimPartyHold(req, res);
  });
  return router;

  async function bookParty(req: Request, res: Response) {
    const auth = readAuthContext(req)!;
    const input = createPartyBookingSchema.parse(req.body);
    const quoted = await quoteParty(res, input);
    if (!quoted) return;
    const minutes = await holdMinutes(parties);
    let booking;
    try {
      booking = await db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [quoted.venueId]);
        if (await slotBusy((sql, values) => client.query(sql, [...values]), quoted.venueId, quoted.start.toISOString(), quoted.end.toISOString(), quoted.partyRoomId)) throw new SlotTaken();
        const inserted = await client.query(
          `INSERT INTO bookings(
             user_id, machine_id, start_at, duration_minutes, amount_cents, currency, status,
             venue_id, package_code, guest_count, party_room_id, hold_expires_at
           ) VALUES($1,NULL,$2,$3,$4,$5,'PENDING_PAYMENT',$6,$7,$8,$9, now() + make_interval(mins => $10::integer)) RETURNING *`,
          [
            auth.subject,
            quoted.start.toISOString(),
            quoted.durationMinutes,
            quoted.amountCents,
            quoted.currency,
            quoted.venueId,
            quoted.packageCode,
            quoted.guestCount,
            quoted.partyRoomId,
            minutes,
          ],
        );
        return inserted.rows[0];
      });
    } catch (error) {
      if (error instanceof SlotTaken) {
        res.status(409).json({ success: false, message: 'That party slot is already booked', code: 'PARTY_SLOT_UNAVAILABLE' });
        return;
      }
      throw error;
    }
    res.status(201).json({ success: true, data: booking });
  }

  async function createPartyHold(req: Request, res: Response) {
    const input = createPartyBookingSchema.parse(req.body);
    const quoted = await quoteParty(res, input);
    if (!quoted) return;
    const minutes = await holdMinutes(parties);
    const token = randomBytes(24).toString('hex');
    let hold;
    try {
      hold = await db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [quoted.venueId]);
        if (await slotBusy((sql, values) => client.query(sql, [...values]), quoted.venueId, quoted.start.toISOString(), quoted.end.toISOString(), quoted.partyRoomId)) throw new SlotTaken();
        const inserted = await client.query(
          `INSERT INTO party_holds(
             token, venue_id, package_code, guest_count, party_room_id, start_at,
             duration_minutes, amount_cents, currency, expires_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + make_interval(mins => $10::integer)) RETURNING id, expires_at`,
          [
            token,
            quoted.venueId,
            quoted.packageCode,
            quoted.guestCount,
            quoted.partyRoomId,
            quoted.start.toISOString(),
            quoted.durationMinutes,
            quoted.amountCents,
            quoted.currency,
            minutes,
          ],
        );
        return inserted.rows[0] as { id: string; expires_at: Date | string };
      });
    } catch (error) {
      if (error instanceof SlotTaken) {
        res.status(409).json({ success: false, message: 'That time is held. Pick another one.', code: 'PARTY_SLOT_UNAVAILABLE' });
        return;
      }
      throw error;
    }
    res.status(201).json({
      success: true,
      data: { id: hold.id, token, expiresAt: new Date(hold.expires_at).toISOString() },
    });
  }

  async function releasePartyHold(req: Request, res: Response) {
    const token = z.object({ token: z.string().min(16).max(200) }).safeParse(req.body);
    const id = z.uuid().safeParse(req.params.id);
    if (!token.success || !id.success) {
      res.status(400).json({ success: false, message: 'That hold could not be released', code: 'VALIDATION_ERROR' });
      return;
    }
    await db.query(
      `DELETE FROM party_holds WHERE id=$1 AND token=$2 AND booking_id IS NULL`,
      [id.data, token.data.token],
    );
    res.status(204).send();
  }

  async function claimPartyHold(req: Request, res: Response) {
    const auth = readAuthContext(req)!;
    const token = z.object({ token: z.string().min(16).max(200) }).safeParse(req.body);
    const id = z.uuid().safeParse(req.params.id);
    if (!token.success || !id.success) {
      res.status(400).json({ success: false, message: 'That hold could not be used', code: 'VALIDATION_ERROR' });
      return;
    }
    try {
      const booking = await db.transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [id.data]);
        const found = await client.query(
          `SELECT * FROM party_holds WHERE id=$1 AND token=$2 FOR UPDATE`,
          [id.data, token.data.token],
        );
        const hold = found.rows[0] as Record<string, unknown> | undefined;
        if (!hold) throw new HoldMissing();
        if (hold.booking_id) {
          const existing = await client.query('SELECT * FROM bookings WHERE id=$1', [hold.booking_id]);
          const row = existing.rows[0] as Record<string, unknown> | undefined;
          if (!row || row.user_id !== auth.subject) throw new HoldMissing();
          if (row.status === 'PAYMENT_FAILED' || row.status === 'CANCELLED' || new Date(String(row.hold_expires_at)) <= new Date()) {
            throw new HoldExpired();
          }
          return row;
        }
        if (new Date(String(hold.expires_at)) <= new Date()) throw new HoldExpired();
        const start = new Date(String(hold.start_at));
        const end = new Date(start.getTime() + Number(hold.duration_minutes) * 60_000);
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [String(hold.venue_id)]);
        if (await slotBusy((sql, values) => client.query(sql, [...values]), String(hold.venue_id), start.toISOString(), end.toISOString(), (hold.party_room_id as string | null) ?? null, id.data)) {
          throw new SlotTaken();
        }
        const inserted = await client.query(
          `INSERT INTO bookings(
             user_id, machine_id, start_at, duration_minutes, amount_cents, currency, status,
             venue_id, package_code, guest_count, party_room_id, hold_expires_at
           ) VALUES($1,NULL,$2,$3,$4,$5,'PENDING_PAYMENT',$6,$7,$8,$9,$10) RETURNING *`,
          [
            auth.subject,
            start.toISOString(),
            hold.duration_minutes,
            hold.amount_cents,
            hold.currency,
            hold.venue_id,
            hold.package_code,
            hold.guest_count,
            hold.party_room_id ?? null,
            new Date(String(hold.expires_at)).toISOString(),
          ],
        );
        const row = inserted.rows[0] as Record<string, unknown>;
        await client.query('UPDATE party_holds SET booking_id=$2 WHERE id=$1', [id.data, row.id]);
        return row;
      });
      res.status(201).json({ success: true, data: { id: booking.id, holdExpiresAt: booking.hold_expires_at } });
    } catch (error) {
      if (error instanceof HoldExpired) {
        res.status(409).json({ success: false, message: 'This reservation time ran out. Choose the time again.', code: 'HOLD_EXPIRED' });
        return;
      }
      if (error instanceof SlotTaken) {
        res.status(409).json({ success: false, message: 'That party slot is already booked', code: 'PARTY_SLOT_UNAVAILABLE' });
        return;
      }
      if (error instanceof HoldMissing) {
        res.status(404).json({ success: false, message: 'This reservation time ran out. Choose the time again.', code: 'HOLD_NOT_FOUND' });
        return;
      }
      throw error;
    }
  }

  async function quoteParty(res: Response, input: z.infer<typeof createPartyBookingSchema>) {
    if (!parties) {
      res.status(503).json({ success: false, message: 'Party booking is unavailable', code: 'PARTY_CATALOG_UNAVAILABLE' });
      return;
    }
    let venue;
    let packages;
    let hours;
    let blackouts;
    let rooms;
    try {
      [venue, packages, hours, blackouts, rooms] = await Promise.all([
        parties.venue(input.venueId),
        parties.packages(input.venueId),
        parties.hours(input.venueId),
        parties.blackouts(input.venueId),
        parties.rooms(input.venueId),
      ]);
    } catch {
      res.status(422).json({ success: false, message: 'That venue could not be booked', code: 'VENUE_UNAVAILABLE' });
      return;
    }
    if (!venue.active) {
      res.status(422).json({ success: false, message: 'That venue is not open for booking', code: 'VENUE_INACTIVE' });
      return;
    }
    const pack = packages.find((item) => item.code === input.packageCode && item.active);
    if (!pack) {
      res.status(422).json({ success: false, message: 'That package is not offered at this venue', code: 'PACKAGE_UNAVAILABLE' });
      return;
    }
    if (input.guestCount < pack.minGuests || input.guestCount > pack.maxGuests) {
      res.status(422).json({
        success: false,
        message: `This package is for ${pack.minGuests} to ${pack.maxGuests} guests`,
        code: 'GUEST_COUNT_INVALID',
      });
      return;
    }
    const amountCents = pack.pricePerPersonCents * input.guestCount;
    if (amountCents <= 0) {
      res.status(422).json({ success: false, message: 'This package has no price', code: 'PACKAGE_UNPRICED' });
      return;
    }
    const room = input.partyRoomId ? rooms.find((item) => item.id === input.partyRoomId && item.active) : undefined;
    if (input.partyRoomId && !room) {
      res.status(422).json({ success: false, message: 'That party room is not available', code: 'ROOM_UNAVAILABLE' });
      return;
    }
    if (room && input.guestCount > room.capacity) {
      res.status(422).json({ success: false, message: 'That room is too small for this group', code: 'ROOM_TOO_SMALL' });
      return;
    }
    const start = new Date(input.startAt);
    if (start.getTime() <= Date.now()) {
      res.status(422).json({ success: false, message: 'That time has already passed', code: 'SLOT_PASSED' });
      return;
    }
    const end = new Date(start.getTime() + pack.durationMinutes * 60_000);
    const zone = venue.timezone || 'Asia/Kolkata';
    const local = localParts(start, zone);
    const localEnd = localParts(end, zone);
    if (local.date !== localEnd.date) {
      res.status(422).json({ success: false, message: 'A party must finish on the same day it starts', code: 'OUTSIDE_HOURS' });
      return;
    }
    const day = hours.find((item) => item.dayOfWeek === local.weekday && item.active);
    if (!day || local.minutes < minutesOf(day.opensAt) || localEnd.minutes > minutesOf(day.closesAt)) {
      res.status(422).json({ success: false, message: 'That time is outside venue hours', code: 'OUTSIDE_HOURS' });
      return;
    }
    if (blackouts.some((item) => item.blackoutDate === local.date)) {
      res.status(422).json({ success: false, message: 'The venue is closed on that date', code: 'VENUE_BLACKOUT' });
      return;
    }
    const clock = `${String(Math.floor(local.minutes / 60)).padStart(2, '0')}:${String(local.minutes % 60).padStart(2, '0')}`;
    if (!partyStartClocks.includes(clock as (typeof partyStartClocks)[number])) {
      res.status(422).json({ success: false, message: 'Parties start at 11:00 AM, 3:00 PM, or 7:00 PM', code: 'SLOT_NOT_OFFERED' });
      return;
    }
    return {
      start,
      end,
      durationMinutes: pack.durationMinutes,
      amountCents,
      currency: pack.currency,
      venueId: input.venueId,
      packageCode: input.packageCode,
      guestCount: input.guestCount,
      partyRoomId: input.partyRoomId ?? null,
    };
  }
}

class SlotTaken extends Error {}
class HoldExpired extends Error {}
class HoldMissing extends Error {}

async function slotBusy(
  query: (sql: string, values: readonly unknown[]) => Promise<{ rows: unknown[] }>,
  venueId: string,
  startIso: string,
  endIso: string,
  roomId: string | null,
  ignoreHoldId?: string,
) {
  const booking = await query(
    `SELECT id FROM bookings
     WHERE venue_id=$1
       AND ${activeHoldSql}
       AND start_at < $3
       AND start_at + (duration_minutes * interval '1 minute') > $2
       AND (($4::uuid IS NULL AND party_room_id IS NULL) OR party_room_id=$4)
     LIMIT 1`,
    [venueId, startIso, endIso, roomId],
  );
  if (booking.rows[0]) return true;
  const hold = await query(
    `SELECT id FROM party_holds
     WHERE venue_id=$1
       AND booking_id IS NULL
       AND expires_at > now()
       AND ($5::uuid IS NULL OR id <> $5::uuid)
       AND start_at < $3
       AND start_at + (duration_minutes * interval '1 minute') > $2
       AND (($4::uuid IS NULL AND party_room_id IS NULL) OR party_room_id=$4)
     LIMIT 1`,
    [venueId, startIso, endIso, roomId, ignoreHoldId ?? null],
  );
  return Boolean(hold.rows[0]);
}

async function holdMinutes(parties?: PartyCatalog) {
  if (!parties) return 10;
  try {
    return (await parties.rules()).holdMinutes;
  } catch {
    return 10;
  }
}

function zonedStart(day: string, clock: string, timeZone: string) {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = clock.split(':').map(Number);
  const guess = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hour ?? 0, minute ?? 0);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(guess));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return new Date(guess - (asUtc - guess)).toISOString();
}

function minutesOf(clock: string) {
  const [hour, minute] = clock.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    date: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: Number(read('hour')) * 60 + Number(read('minute')),
    weekday: weekdays.indexOf(read('weekday')),
  };
}

function canManageBooking(
  roles: { has(role: 'ADMIN' | 'STAFF'): boolean },
  subject: string,
  ownerId: string,
) {
  return roles.has('ADMIN') || roles.has('STAFF') || subject === ownerId;
}

function editableStatus(status: string) {
  return status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED';
}

