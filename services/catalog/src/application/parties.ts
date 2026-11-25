import { Router } from 'express';
import type { QueryResultRow } from 'pg';
import {
  bookingRulesSchema,
  createInclusionSchema,
  createPackageTemplateSchema,
  createPartyRoomSchema,
  createPartyTypeSchema,
  createVenueBlackoutSchema,
  createVenueSchema,
  packageCodeSchema,
  replaceVenueHoursSchema,
  updateInclusionSchema,
  updatePackageTemplateSchema,
  updatePartyRoomSchema,
  updatePartyTypeSchema,
  updateVenuePackageSchema,
  updateVenueSchema,
  type BookingRules,
  type Inclusion,
  type PackageTemplate,
  type PartyRoom,
  type PartyType,
  type Venue,
  type VenueBlackout,
  type VenuePackage,
} from '@arcade/contracts';
import { requireAnyRole, requireAuth } from '@arcade/service-auth';
import { Postgres } from '../adapters/postgres';

type Sql = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

class PartyHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const venueColumns = `v.id, v.name, v.slug, v.city, v.mall, v.address, v.phone, v.email,
  v.description, v.timezone, v.active, v.created_at AS "createdAt",
  COALESCE((SELECT array_agg(party_type_id) FROM venue_party_types WHERE venue_id = v.id), '{}') AS "partyTypeIds",
  COALESCE((SELECT array_agg(code ORDER BY sort_order) FROM venue_packages WHERE venue_id = v.id), '{}') AS "packageCodes"`;

const packageColumns = `id, venue_id AS "venueId", code, name, description,
  price_per_person_cents AS "pricePerPersonCents", currency,
  min_guests AS "minGuests", max_guests AS "maxGuests",
  duration_minutes AS "durationMinutes", sort_order AS "sortOrder", active,
  COALESCE((SELECT array_agg(inclusion_id) FROM venue_package_inclusions WHERE venue_package_id = venue_packages.id), '{}') AS "inclusionIds"`;

const templateColumns = `code, name, description,
  price_per_person_cents AS "pricePerPersonCents", currency,
  min_guests AS "minGuests", max_guests AS "maxGuests",
  duration_minutes AS "durationMinutes", sort_order AS "sortOrder", active,
  COALESCE((SELECT array_agg(inclusion_id) FROM package_template_inclusions WHERE template_code = package_templates.code), '{}') AS "inclusionIds"`;

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  city: string;
  mall: string;
  address: string;
  phone: string;
  email: string;
  description: string;
  timezone: string;
  active: boolean;
  createdAt: Date | string;
  partyTypeIds: string[] | null;
  packageCodes: string[] | null;
};

type PackageRow = {
  id?: string;
  venueId?: string;
  code: PackageTemplate['code'];
  name: string;
  description: string;
  pricePerPersonCents: number;
  currency: string;
  minGuests: number;
  maxGuests: number;
  durationMinutes: number;
  sortOrder: number;
  active: boolean;
  inclusionIds: string[] | null;
};

export function partyRoutes(db: Postgres): Router {
  const router = Router();
  const staff = requireAnyRole('ADMIN', 'STAFF');

  router.get('/party-types', requireAuth, async (_req, res) => {
    const rows = (await db.query<PartyType>(
      `SELECT id, code, title, description, sort_order AS "sortOrder", active
       FROM party_types ORDER BY sort_order`,
    )).rows;
    res.json({ success: true, data: rows });
  });

  router.post('/party-types', staff, async (req, res) => {
    const input = createPartyTypeSchema.parse(req.body);
    const code = slugFromName(input.title);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Party type title needs letters or numbers', code: 'PARTY_TYPE_CODE_INVALID' });
    }
    try {
      const created = await db.query<PartyType>(
        `INSERT INTO party_types(code, title, description, sort_order, active)
         VALUES($1,$2,$3, COALESCE($4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM party_types)), $5)
         RETURNING id, code, title, description, sort_order AS "sortOrder", active`,
        [code, input.title, input.description ?? '', input.sortOrder ?? null, input.active ?? true],
      );
      return res.status(201).json({ success: true, data: created.rows[0] });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'PARTY_TYPE_EXISTS' });
      throw error;
    }
  });

  router.patch('/party-types/:id', staff, async (req, res) => {
    const input = updatePartyTypeSchema.parse(req.body);
    const updated = await db.query<PartyType>(
      `UPDATE party_types
       SET title=$2, description=$3, active=$4
       WHERE id=$1
       RETURNING id, code, title, description, sort_order AS "sortOrder", active`,
      [req.params.id, input.title, input.description, input.active],
    );
    const row = updated.rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Party type was not found', code: 'PARTY_TYPE_NOT_FOUND' });
    }
    return res.json({ success: true, data: row });
  });

  router.delete('/party-types/:id', staff, async (req, res) => {
    const removed = await db.query('DELETE FROM party_types WHERE id=$1', [req.params.id]);
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Party type was not found', code: 'PARTY_TYPE_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/inclusions', requireAuth, async (_req, res) => {
    const rows = (await db.query<Inclusion>(
      `SELECT id, name, description, sort_order AS "sortOrder", active
       FROM inclusions ORDER BY sort_order, name`,
    )).rows;
    res.json({ success: true, data: rows });
  });

  router.post('/inclusions', staff, async (req, res) => {
    const input = createInclusionSchema.parse(req.body);
    try {
      const created = await db.query<Inclusion>(
        `INSERT INTO inclusions(name, description, sort_order, active)
         VALUES($1,$2,$3,$4)
         RETURNING id, name, description, sort_order AS "sortOrder", active`,
        [input.name, input.description ?? '', input.sortOrder ?? 0, input.active ?? true],
      );
      return res.status(201).json({ success: true, data: created.rows[0] });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'INCLUSION_NAME_TAKEN' });
      throw error;
    }
  });

  router.patch('/inclusions/:id', staff, async (req, res) => {
    const input = updateInclusionSchema.parse(req.body);
    const current = await db.query<Inclusion>(
      `SELECT id, name, description, sort_order AS "sortOrder", active FROM inclusions WHERE id=$1`,
      [req.params.id],
    );
    const existing = current.rows[0];
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inclusion was not found', code: 'INCLUSION_NOT_FOUND' });
    }
    try {
      const updated = await db.query<Inclusion>(
        `UPDATE inclusions SET name=$2, description=$3, sort_order=$4, active=$5 WHERE id=$1
         RETURNING id, name, description, sort_order AS "sortOrder", active`,
        [
          existing.id,
          input.name ?? existing.name,
          input.description ?? existing.description,
          input.sortOrder ?? existing.sortOrder,
          input.active ?? existing.active,
        ],
      );
      return res.json({ success: true, data: updated.rows[0] });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'INCLUSION_NAME_TAKEN' });
      throw error;
    }
  });

  router.delete('/inclusions/:id', staff, async (req, res) => {
    const removed = await db.query('DELETE FROM inclusions WHERE id=$1', [req.params.id]);
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Inclusion was not found', code: 'INCLUSION_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/package-templates', requireAuth, async (_req, res) => {
    const rows = (await db.query<PackageRow>(`SELECT ${templateColumns} FROM package_templates ORDER BY sort_order`)).rows;
    res.json({ success: true, data: rows.map(mapTemplate) });
  });

  router.post('/package-templates', staff, async (req, res) => {
    const input = createPackageTemplateSchema.parse(req.body);
    const code = slugFromName(input.name);
    if (!code) {
      return res.status(400).json({ success: false, message: 'Package name needs letters or numbers', code: 'PACKAGE_CODE_INVALID' });
    }
    try {
      const created = await db.transaction(async (client) => {
        const sql = client as unknown as Sql;
        await assertInclusions(sql, input.inclusionIds);
        const result = await sql.query<PackageRow>(
          `INSERT INTO package_templates(
             code, name, description, price_per_person_cents, currency, min_guests, max_guests,
             duration_minutes, sort_order, active)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM package_templates)), $10)
           RETURNING code, name, description, price_per_person_cents AS "pricePerPersonCents", currency,
             min_guests AS "minGuests", max_guests AS "maxGuests", duration_minutes AS "durationMinutes",
             sort_order AS "sortOrder", active, $11::uuid[] AS "inclusionIds"`,
          [
            code, input.name, input.description, input.pricePerPersonCents, input.currency,
            input.minGuests, input.maxGuests, input.durationMinutes, input.sortOrder ?? null,
            input.active, input.inclusionIds,
          ],
        );
        const row = result.rows[0];
        if (!row) throw new PartyHttpError(500, 'PACKAGE_CREATE_FAILED', 'Could not create the package');
        await replaceTemplateInclusions(sql, code, input.inclusionIds);
        return mapTemplate(row);
      });
      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'PACKAGE_EXISTS' });
      return sendPartyError(res, error);
    }
  });

  router.patch('/package-templates/:code', staff, async (req, res) => {
    const code = packageCodeSchema.parse(req.params.code);
    const input = updatePackageTemplateSchema.parse(req.body);
    try {
      const updated = await db.transaction(async (client) => {
        const sql = client as unknown as Sql;
        await assertInclusions(sql, input.inclusionIds);
        const result = await sql.query<PackageRow>(
          `UPDATE package_templates
           SET name=$2, description=$3, price_per_person_cents=$4, currency=$5, min_guests=$6, max_guests=$7,
               duration_minutes=$8, active=$9, updated_at=now()
           WHERE code=$1
           RETURNING code, name, description, price_per_person_cents AS "pricePerPersonCents", currency,
             min_guests AS "minGuests", max_guests AS "maxGuests", duration_minutes AS "durationMinutes",
             sort_order AS "sortOrder", active, $10::uuid[] AS "inclusionIds"`,
          [
            code, input.name, input.description, input.pricePerPersonCents, input.currency,
            input.minGuests, input.maxGuests, input.durationMinutes, input.active, input.inclusionIds,
          ],
        );
        const row = result.rows[0];
        if (!row) return null;
        await replaceTemplateInclusions(sql, code, input.inclusionIds);
        return mapTemplate(row);
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Package default was not found', code: 'PACKAGE_TEMPLATE_NOT_FOUND' });
      }
      return res.json({ success: true, data: updated });
    } catch (error) {
      return sendPartyError(res, error);
    }
  });

  router.delete('/package-templates/:code', staff, async (req, res) => {
    const code = packageCodeSchema.parse(req.params.code);
    const removed = await db.query('DELETE FROM package_templates WHERE code=$1', [code]);
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Package was not found', code: 'PACKAGE_TEMPLATE_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/booking-rules', requireAuth, async (_req, res) => {
    const row = (await db.query<BookingRules>(
      `SELECT hold_minutes AS "holdMinutes", min_guests AS "minGuests",
              slot_minutes AS "slotMinutes", refund_policy AS "refundPolicy"
       FROM booking_rules WHERE id = true`,
    )).rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Booking rules are not configured', code: 'BOOKING_RULES_MISSING' });
    }
    return res.json({ success: true, data: bookingRulesSchema.parse(row) });
  });

  router.put('/booking-rules', staff, async (req, res) => {
    const input = bookingRulesSchema.parse(req.body);
    const row = (await db.query<BookingRules>(
      `INSERT INTO booking_rules(id, hold_minutes, min_guests, slot_minutes, refund_policy)
       VALUES(true,$1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE
         SET hold_minutes=$1, min_guests=$2, slot_minutes=$3, refund_policy=$4, updated_at=now()
       RETURNING hold_minutes AS "holdMinutes", min_guests AS "minGuests",
                 slot_minutes AS "slotMinutes", refund_policy AS "refundPolicy"`,
      [input.holdMinutes, input.minGuests, input.slotMinutes, input.refundPolicy],
    )).rows[0];
    return res.json({ success: true, data: row });
  });

  router.get('/venues', requireAuth, async (_req, res) => {
    const rows = (await db.query<VenueRow>(`SELECT ${venueColumns} FROM venues v ORDER BY v.name`)).rows;
    res.json({ success: true, data: rows.map(mapVenue) });
  });

  router.post('/venues', staff, async (req, res) => {
    const input = createVenueSchema.parse(req.body);
    try {
      const created = await db.transaction(async (client) => {
        const sql = client as unknown as Sql;
        await assertPackageCodes(sql, input.packageCodes);
        await assertPartyTypes(sql, input.partyTypeIds);
        const inserted = await sql.query<VenueRow>(
          `INSERT INTO venues(name, slug, city, mall, address, phone, email, description, timezone, active)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING id, name, slug, city, mall, address, phone, email, description, timezone, active,
                     created_at AS "createdAt", $11::uuid[] AS "partyTypeIds", $12::text[] AS "packageCodes"`,
          [
            input.name, input.slug, input.city ?? '', input.mall ?? '', input.address ?? '',
            input.phone ?? '', input.email ?? '', input.description ?? '',
            input.timezone ?? 'Asia/Kolkata', input.active ?? true, input.partyTypeIds, input.packageCodes,
          ],
        );
        const venue = inserted.rows[0];
        if (!venue) throw new PartyHttpError(500, 'VENUE_CREATE_FAILED', 'Could not create the venue');
        await sql.query(
          `INSERT INTO venue_party_types(venue_id, party_type_id)
           SELECT $1, id FROM party_types WHERE id = ANY($2::uuid[])`,
          [venue.id, input.partyTypeIds],
        );
        await copySelectedPackages(sql, venue.id, input.packageCodes);
        await sql.query(
          `INSERT INTO venue_hours(venue_id, day_of_week, opens_at, closes_at, slot_minutes, active)
           SELECT $1, day, '11:00', '21:00', 60, true FROM generate_series(0, 6) AS day`,
          [venue.id],
        );
        return mapVenue(venue);
      });
      return res.status(201).json({ success: true, data: created });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'VENUE_SLUG_TAKEN' });
      return sendPartyError(res, error);
    }
  });

  router.get('/venues/:venueId', requireAuth, async (req, res) => {
    const venue = await loadVenue(db, String(req.params.venueId));
    if (!venue) return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    return res.json({ success: true, data: venue });
  });

  router.patch('/venues/:venueId', staff, async (req, res) => {
    const input = updateVenueSchema.parse(req.body);
    try {
      const updated = await db.transaction(async (client) => {
        const sql = client as unknown as Sql;
        await assertPackageCodes(sql, input.packageCodes);
        await assertPartyTypes(sql, input.partyTypeIds);
        const result = await sql.query<VenueRow>(
          `UPDATE venues
           SET name=$2, slug=$3, city=$4, mall=$5, address=$6, phone=$7, email=$8, description=$9, timezone=$10, active=$11
           WHERE id=$1
           RETURNING id, name, slug, city, mall, address, phone, email, description, timezone, active,
                     created_at AS "createdAt", $12::uuid[] AS "partyTypeIds", $13::text[] AS "packageCodes"`,
          [
            req.params.venueId, input.name, input.slug, input.city ?? '', input.mall ?? '',
            input.address ?? '', input.phone ?? '', input.email ?? '', input.description ?? '',
            input.timezone ?? 'Asia/Kolkata', input.active ?? true, input.partyTypeIds, input.packageCodes,
          ],
        );
        const venue = result.rows[0];
        if (!venue) return null;
        await sql.query('DELETE FROM venue_party_types WHERE venue_id=$1', [venue.id]);
        await sql.query(
          `INSERT INTO venue_party_types(venue_id, party_type_id)
           SELECT $1, id FROM party_types WHERE id = ANY($2::uuid[])`,
          [venue.id, input.partyTypeIds],
        );
        await syncVenuePackages(sql, venue.id, input.packageCodes);
        return mapVenue(venue);
      });
      if (!updated) return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
      return res.json({ success: true, data: updated });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'VENUE_SLUG_TAKEN' });
      return sendPartyError(res, error);
    }
  });

  router.delete('/venues/:venueId', staff, async (req, res) => {
    const removed = await db.query('DELETE FROM venues WHERE id=$1', [req.params.venueId]);
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/venues/:venueId/packages', requireAuth, async (req, res) => {
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    const rows = (await db.query<PackageRow>(
      `SELECT ${packageColumns} FROM venue_packages WHERE venue_id=$1 ORDER BY sort_order`,
      [req.params.venueId],
    )).rows;
    return res.json({ success: true, data: rows.map(mapVenuePackage) });
  });

  router.patch('/venues/:venueId/packages/:code', staff, async (req, res) => {
    const code = packageCodeSchema.parse(req.params.code);
    const input = updateVenuePackageSchema.parse(req.body);
    try {
      const updated = await db.transaction(async (client) => {
        const sql = client as unknown as Sql;
        await assertInclusions(sql, input.inclusionIds);
        const result = await sql.query<PackageRow>(
          `UPDATE venue_packages
           SET description=$3, price_per_person_cents=$4, currency=$5, min_guests=$6, max_guests=$7,
               duration_minutes=$8, active=$9
           WHERE venue_id=$1 AND code=$2
           RETURNING id, venue_id AS "venueId", code, name, description,
             price_per_person_cents AS "pricePerPersonCents", currency,
             min_guests AS "minGuests", max_guests AS "maxGuests",
             duration_minutes AS "durationMinutes", sort_order AS "sortOrder", active,
             $10::uuid[] AS "inclusionIds"`,
          [
            req.params.venueId, code, input.description, input.pricePerPersonCents, input.currency,
            input.minGuests, input.maxGuests, input.durationMinutes, input.active, input.inclusionIds,
          ],
        );
        const row = result.rows[0];
        if (!row?.id) return null;
        await sql.query('DELETE FROM venue_package_inclusions WHERE venue_package_id=$1', [row.id]);
        await insertPackageInclusions(sql, row.id, input.inclusionIds);
        return mapVenuePackage(row);
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Venue package was not found', code: 'VENUE_PACKAGE_NOT_FOUND' });
      }
      return res.json({ success: true, data: updated });
    } catch (error) {
      return sendPartyError(res, error);
    }
  });

  router.post('/venues/:venueId/packages/:code/reset', staff, async (req, res) => {
    const code = packageCodeSchema.parse(req.params.code);
    const reset = await db.transaction(async (client) => {
      const sql = client as unknown as Sql;
      const result = await sql.query<PackageRow>(
        `UPDATE venue_packages vp
         SET name=t.name, description=t.description, price_per_person_cents=t.price_per_person_cents,
             currency=t.currency, min_guests=t.min_guests, max_guests=t.max_guests,
             duration_minutes=t.duration_minutes, sort_order=t.sort_order, active=t.active
         FROM package_templates t
         WHERE vp.venue_id=$1 AND vp.code=$2 AND t.code=vp.code
         RETURNING vp.id, vp.venue_id AS "venueId", vp.code, vp.name, vp.description,
           vp.price_per_person_cents AS "pricePerPersonCents", vp.currency,
           vp.min_guests AS "minGuests", vp.max_guests AS "maxGuests",
           vp.duration_minutes AS "durationMinutes", vp.sort_order AS "sortOrder", vp.active`,
        [req.params.venueId, code],
      );
      const row = result.rows[0];
      if (!row?.id) return null;
      await sql.query('DELETE FROM venue_package_inclusions WHERE venue_package_id=$1', [row.id]);
      await sql.query(
        `INSERT INTO venue_package_inclusions(venue_package_id, inclusion_id)
         SELECT $1, inclusion_id FROM package_template_inclusions WHERE template_code=$2`,
        [row.id, code],
      );
      const inclusions = await sql.query<{ inclusion_id: string }>(
        'SELECT inclusion_id FROM venue_package_inclusions WHERE venue_package_id=$1',
        [row.id],
      );
      return mapVenuePackage({ ...row, inclusionIds: inclusions.rows.map((item) => item.inclusion_id) });
    });
    if (!reset) {
      return res.status(404).json({ success: false, message: 'Venue package was not found', code: 'VENUE_PACKAGE_NOT_FOUND' });
    }
    return res.json({ success: true, data: reset });
  });

  router.get('/venues/:venueId/rooms', requireAuth, async (req, res) => {
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    const rows = (await db.query<PartyRoom>(
      `SELECT id, venue_id AS "venueId", name, capacity, active
       FROM party_rooms WHERE venue_id=$1 ORDER BY name`,
      [req.params.venueId],
    )).rows;
    return res.json({ success: true, data: rows });
  });

  router.post('/venues/:venueId/rooms', staff, async (req, res) => {
    const input = createPartyRoomSchema.parse(req.body);
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    const created = await db.query<PartyRoom>(
      `INSERT INTO party_rooms(venue_id, name, capacity, active)
       VALUES($1,$2,$3,$4)
       RETURNING id, venue_id AS "venueId", name, capacity, active`,
      [req.params.venueId, input.name, input.capacity, input.active ?? true],
    );
    return res.status(201).json({ success: true, data: created.rows[0] });
  });

  router.patch('/venues/:venueId/rooms/:roomId', staff, async (req, res) => {
    const input = updatePartyRoomSchema.parse(req.body);
    const updated = await db.query<PartyRoom>(
      `UPDATE party_rooms SET name=$3, capacity=$4, active=$5
       WHERE venue_id=$1 AND id=$2
       RETURNING id, venue_id AS "venueId", name, capacity, active`,
      [req.params.venueId, req.params.roomId, input.name, input.capacity, input.active ?? true],
    );
    const row = updated.rows[0];
    if (!row) return res.status(404).json({ success: false, message: 'Party room was not found', code: 'ROOM_NOT_FOUND' });
    return res.json({ success: true, data: row });
  });

  router.delete('/venues/:venueId/rooms/:roomId', staff, async (req, res) => {
    const removed = await db.query(
      'DELETE FROM party_rooms WHERE venue_id=$1 AND id=$2',
      [req.params.venueId, req.params.roomId],
    );
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Party room was not found', code: 'ROOM_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  router.get('/venues/:venueId/hours', requireAuth, async (req, res) => {
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    const rows = (await db.query<{
      dayOfWeek: number;
      opensAt: string;
      closesAt: string;
      slotMinutes: number;
      active: boolean;
    }>(
      `SELECT day_of_week AS "dayOfWeek", to_char(opens_at, 'HH24:MI') AS "opensAt",
              to_char(closes_at, 'HH24:MI') AS "closesAt", slot_minutes AS "slotMinutes", active
       FROM venue_hours WHERE venue_id=$1 ORDER BY day_of_week`,
      [req.params.venueId],
    )).rows;
    return res.json({ success: true, data: rows });
  });

  router.put('/venues/:venueId/hours', staff, async (req, res) => {
    const input = replaceVenueHoursSchema.parse(req.body);
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    await db.transaction(async (client) => {
      const sql = client as unknown as Sql;
      await sql.query('DELETE FROM venue_hours WHERE venue_id=$1', [req.params.venueId]);
      for (const day of input) {
        await sql.query(
          `INSERT INTO venue_hours(venue_id, day_of_week, opens_at, closes_at, slot_minutes, active)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [req.params.venueId, day.dayOfWeek, day.opensAt, day.closesAt, day.slotMinutes, day.active],
        );
      }
    });
    return res.json({ success: true, data: input });
  });

  router.get('/venues/:venueId/blackouts', requireAuth, async (req, res) => {
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    const rows = (await db.query<{ id: string; venueId: string; blackoutDate: string; reason: string }>(
      `SELECT id, venue_id AS "venueId", to_char(blackout_date, 'YYYY-MM-DD') AS "blackoutDate", reason
       FROM venue_blackouts WHERE venue_id=$1 ORDER BY blackout_date`,
      [req.params.venueId],
    )).rows;
    return res.json({ success: true, data: rows.map(mapBlackout) });
  });

  router.post('/venues/:venueId/blackouts', staff, async (req, res) => {
    const input = createVenueBlackoutSchema.parse(req.body);
    if (!(await loadVenue(db, String(req.params.venueId)))) {
      return res.status(404).json({ success: false, message: 'Venue was not found', code: 'VENUE_NOT_FOUND' });
    }
    try {
      const created = await db.query<{ id: string; venueId: string; blackoutDate: string; reason: string }>(
        `INSERT INTO venue_blackouts(venue_id, blackout_date, reason)
         VALUES($1,$2,$3)
         RETURNING id, venue_id AS "venueId", to_char(blackout_date, 'YYYY-MM-DD') AS "blackoutDate", reason`,
        [req.params.venueId, input.blackoutDate, input.reason ?? ''],
      );
      const row = created.rows[0];
      if (!row) throw new PartyHttpError(500, 'BLACKOUT_CREATE_FAILED', 'Could not block that date');
      return res.status(201).json({ success: true, data: mapBlackout(row) });
    } catch (error) {
      const message = uniqueMessage(error);
      if (message) return res.status(409).json({ success: false, message, code: 'BLACKOUT_EXISTS' });
      return sendPartyError(res, error);
    }
  });

  router.delete('/venues/:venueId/blackouts/:blackoutId', staff, async (req, res) => {
    const removed = await db.query(
      'DELETE FROM venue_blackouts WHERE venue_id=$1 AND id=$2',
      [req.params.venueId, req.params.blackoutId],
    );
    if (!removed.rowCount) {
      return res.status(404).json({ success: false, message: 'Blocked date was not found', code: 'BLACKOUT_NOT_FOUND' });
    }
    return res.status(204).send();
  });

  return router;
}

async function loadVenue(db: Postgres, venueId: string): Promise<Venue | null> {
  const row = (await db.query<VenueRow>(`SELECT ${venueColumns} FROM venues v WHERE v.id=$1`, [venueId])).rows[0];
  return row ? mapVenue(row) : null;
}

async function assertPackageCodes(sql: Sql, codes: string[]) {
  const count = Number((await sql.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM package_templates WHERE code = ANY($1::text[])',
    [codes],
  )).rows[0]?.count);
  if (count !== codes.length) {
    throw new PartyHttpError(400, 'PACKAGE_NOT_FOUND', 'Choose packages from the package list');
  }
}

function slugFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

async function assertPartyTypes(sql: Sql, ids: string[]) {
  const count = Number((await sql.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM party_types WHERE id = ANY($1::uuid[])',
    [ids],
  )).rows[0]?.count);
  if (count !== ids.length) {
    throw new PartyHttpError(400, 'PARTY_TYPE_NOT_FOUND', 'Choose party types from the celebration list');
  }
}

async function assertInclusions(sql: Sql, ids: string[]) {
  if (ids.length === 0) return;
  const count = Number((await sql.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM inclusions WHERE id = ANY($1::uuid[])',
    [ids],
  )).rows[0]?.count);
  if (count !== ids.length) {
    throw new PartyHttpError(400, 'INCLUSION_NOT_FOUND', 'One or more inclusions were not found');
  }
}

async function copySelectedPackages(sql: Sql, venueId: string, codes: string[]) {
  await sql.query(
    `INSERT INTO venue_packages(
       venue_id, code, name, description, price_per_person_cents, currency,
       min_guests, max_guests, duration_minutes, sort_order, active)
     SELECT $1, code, name, description, price_per_person_cents, currency,
            min_guests, max_guests, duration_minutes, sort_order, active
     FROM package_templates
     WHERE code = ANY($2::text[])`,
    [venueId, codes],
  );
  await copyPackageInclusions(sql, venueId, codes);
}

async function syncVenuePackages(sql: Sql, venueId: string, codes: string[]) {
  await sql.query(
    `DELETE FROM venue_packages WHERE venue_id=$1 AND NOT (code = ANY($2::text[]))`,
    [venueId, codes],
  );
  await sql.query(
    `INSERT INTO venue_packages(
       venue_id, code, name, description, price_per_person_cents, currency,
       min_guests, max_guests, duration_minutes, sort_order, active)
     SELECT $1, t.code, t.name, t.description, t.price_per_person_cents, t.currency,
            t.min_guests, t.max_guests, t.duration_minutes, t.sort_order, t.active
     FROM package_templates t
     WHERE t.code = ANY($2::text[])
       AND NOT EXISTS (
         SELECT 1 FROM venue_packages vp WHERE vp.venue_id=$1 AND vp.code=t.code
       )`,
    [venueId, codes],
  );
  await copyPackageInclusions(sql, venueId, codes);
}

async function copyPackageInclusions(sql: Sql, venueId: string, codes: string[]) {
  await sql.query(
    `INSERT INTO venue_package_inclusions(venue_package_id, inclusion_id)
     SELECT vp.id, link.inclusion_id
     FROM venue_packages vp
     INNER JOIN package_template_inclusions link ON link.template_code = vp.code
     WHERE vp.venue_id=$1 AND vp.code = ANY($2::text[])
     ON CONFLICT DO NOTHING`,
    [venueId, codes],
  );
}

async function replaceTemplateInclusions(sql: Sql, code: string, inclusionIds: string[]) {
  await sql.query('DELETE FROM package_template_inclusions WHERE template_code=$1', [code]);
  if (inclusionIds.length === 0) return;
  await sql.query(
    `INSERT INTO package_template_inclusions(template_code, inclusion_id)
     SELECT $1, id FROM inclusions WHERE id = ANY($2::uuid[])`,
    [code, inclusionIds],
  );
}

async function insertPackageInclusions(sql: Sql, packageId: string, inclusionIds: string[]) {
  if (inclusionIds.length === 0) return;
  await sql.query(
    `INSERT INTO venue_package_inclusions(venue_package_id, inclusion_id)
     SELECT $1, id FROM inclusions WHERE id = ANY($2::uuid[])`,
    [packageId, inclusionIds],
  );
}

function mapVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    mall: row.mall,
    address: row.address,
    phone: row.phone,
    email: row.email,
    description: row.description,
    timezone: row.timezone,
    active: row.active,
    partyTypeIds: row.partyTypeIds ?? [],
    packageCodes: row.packageCodes ?? [],
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function mapTemplate(row: PackageRow): PackageTemplate {
  return {
    code: row.code,
    name: row.name,
    description: row.description,
    pricePerPersonCents: row.pricePerPersonCents,
    currency: row.currency.trim(),
    minGuests: row.minGuests,
    maxGuests: row.maxGuests,
    durationMinutes: row.durationMinutes,
    sortOrder: row.sortOrder,
    active: row.active,
    inclusionIds: row.inclusionIds ?? [],
  };
}

function mapVenuePackage(row: PackageRow): VenuePackage {
  if (!row.id || !row.venueId) {
    throw new PartyHttpError(500, 'VENUE_PACKAGE_INVALID', 'Venue package is incomplete');
  }
  return { ...mapTemplate(row), id: row.id, venueId: row.venueId };
}

function mapBlackout(row: { id: string; venueId: string; blackoutDate: string; reason: string }): VenueBlackout {
  return {
    id: row.id,
    venueId: row.venueId,
    blackoutDate: String(row.blackoutDate).slice(0, 10),
    reason: row.reason,
  };
}

function uniqueMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== '23505') return null;
  const constraint = 'constraint' in error ? String(error.constraint) : '';
  if (constraint.includes('slug')) return 'A venue with this booking link already exists';
  if (constraint.includes('party_types')) return 'A party type with this name already exists';
  if (constraint.includes('package_templates')) return 'A package with this name already exists';
  if (constraint.includes('blackout')) return 'That date is already blocked';
  if (constraint.includes('inclusion') || constraint.includes('name')) return 'An inclusion with this name already exists';
  return 'That value is already in use';
}

function sendPartyError(res: { status: (code: number) => { json: (body: unknown) => unknown } }, error: unknown) {
  if (error instanceof PartyHttpError) {
    return res.status(error.status).json({ success: false, message: error.message, code: error.code });
  }
  throw error;
}
