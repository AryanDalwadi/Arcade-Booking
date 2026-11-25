import type { ApiSuccess, BookingRules, CreateInclusion, CreatePackageTemplate, CreatePartyRoom, CreatePartyType, CreateVenue, CreateVenueBlackout, Inclusion, PackageTemplate, PartyRoom, PartyType, UpdateInclusion, UpdatePackageTemplate, UpdatePartyType, UpdateVenue, UpdateVenuePackage, Venue, VenueBlackout, VenueHour, VenuePackage } from '@arcade/contracts';
import { api } from '../api';

const catalog = '/api/catalog';

async function data<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await api<ApiSuccess<T>>(path, init);
  return response.data;
}

export const listPartyTypes = () => data<PartyType[]>(`${catalog}/party-types`);
export const createPartyType = (body: CreatePartyType) => data<PartyType>(`${catalog}/party-types`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const updatePartyType = (id: string, body: UpdatePartyType) => data<PartyType>(`${catalog}/party-types/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});
export const deletePartyType = (id: string) => api<undefined>(`${catalog}/party-types/${id}`, { method: 'DELETE' });

export const listInclusions = () => data<Inclusion[]>(`${catalog}/inclusions`);
export const createInclusion = (body: CreateInclusion) => data<Inclusion>(`${catalog}/inclusions`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const updateInclusion = (id: string, body: UpdateInclusion) => data<Inclusion>(`${catalog}/inclusions/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});
export const deleteInclusion = (id: string) => api<undefined>(`${catalog}/inclusions/${id}`, { method: 'DELETE' });

export const listPackageTemplates = () => data<PackageTemplate[]>(`${catalog}/package-templates`);
export const createPackageTemplate = (body: CreatePackageTemplate) => data<PackageTemplate>(`${catalog}/package-templates`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const updatePackageTemplate = (code: PackageTemplate['code'], body: UpdatePackageTemplate) => data<PackageTemplate>(`${catalog}/package-templates/${code}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});
export const deletePackageTemplate = (code: string) => api<undefined>(`${catalog}/package-templates/${code}`, { method: 'DELETE' });

export const getBookingRules = () => data<BookingRules>(`${catalog}/booking-rules`);
export const saveBookingRules = (body: BookingRules) => data<BookingRules>(`${catalog}/booking-rules`, {
  method: 'PUT',
  body: JSON.stringify(body),
});

export const listVenues = () => data<Venue[]>(`${catalog}/venues`);
export const createVenue = (body: CreateVenue) => data<Venue>(`${catalog}/venues`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const updateVenue = (id: string, body: UpdateVenue) => data<Venue>(`${catalog}/venues/${id}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});
export const deleteVenue = (id: string) => api<undefined>(`${catalog}/venues/${id}`, { method: 'DELETE' });

export const listVenuePackages = (venueId: string) => data<VenuePackage[]>(`${catalog}/venues/${venueId}/packages`);
export const updateVenuePackage = (venueId: string, code: VenuePackage['code'], body: UpdateVenuePackage) => data<VenuePackage>(`${catalog}/venues/${venueId}/packages/${code}`, {
  method: 'PATCH',
  body: JSON.stringify(body),
});
export const resetVenuePackage = (venueId: string, code: VenuePackage['code']) => data<VenuePackage>(`${catalog}/venues/${venueId}/packages/${code}/reset`, {
  method: 'POST',
});

export const listRooms = (venueId: string) => data<PartyRoom[]>(`${catalog}/venues/${venueId}/rooms`);
export const createRoom = (venueId: string, body: CreatePartyRoom) => data<PartyRoom>(`${catalog}/venues/${venueId}/rooms`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const deleteRoom = (venueId: string, roomId: string) => api<undefined>(`${catalog}/venues/${venueId}/rooms/${roomId}`, { method: 'DELETE' });

export const listHours = (venueId: string) => data<VenueHour[]>(`${catalog}/venues/${venueId}/hours`);
export const saveHours = (venueId: string, body: VenueHour[]) => data<VenueHour[]>(`${catalog}/venues/${venueId}/hours`, {
  method: 'PUT',
  body: JSON.stringify(body),
});

export const listBlackouts = (venueId: string) => data<VenueBlackout[]>(`${catalog}/venues/${venueId}/blackouts`);
export const createBlackout = (venueId: string, body: CreateVenueBlackout) => data<VenueBlackout>(`${catalog}/venues/${venueId}/blackouts`, {
  method: 'POST',
  body: JSON.stringify(body),
});
export const deleteBlackout = (venueId: string, blackoutId: string) => api<undefined>(`${catalog}/venues/${venueId}/blackouts/${blackoutId}`, { method: 'DELETE' });

export function formatInr(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(cents / 100);
}

export function centsFromRupees(value: string): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

export function rupeesFromCents(cents: number) {
  return (cents / 100).toString();
}

export function slugFromName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
