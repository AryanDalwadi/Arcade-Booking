import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, Booking, CreateBookingRequest } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

type BookingState = {
  bookings: BookingListItem[];
  listStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  mutationStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  listError: string | null;
  createError: string | null;
  mutationError: string | null;
};

const initialState: BookingState = {
  bookings: [],
  listStatus: 'idle',
  createStatus: 'idle',
  mutationStatus: 'idle',
  listError: null,
  createError: null,
  mutationError: null,
};

export type BookingListItem = Booking & {
  paymentStatus?: 'PENDING' | 'COMPLETED' | 'FAILED';
};

type BookingWire = Partial<BookingListItem> & {
  user_id?: string;
  machine_id?: string;
  start_at?: string;
  duration_minutes?: number;
  amount_cents?: number;
  created_at?: string;
  payment_status?: string;
};

function paymentStatusOf(value: string | undefined): BookingListItem['paymentStatus'] {
  if (value === 'PENDING' || value === 'COMPLETED' || value === 'FAILED') return value;
  return undefined;
}

function normalizeBooking(value: BookingWire): BookingListItem {
  return {
    id: String(value.id),
    userId: String(value.userId ?? value.user_id),
    machineId: String(value.machineId ?? value.machine_id),
    startAt: new Date(String(value.startAt ?? value.start_at)).toISOString(),
    durationMinutes: Number(value.durationMinutes ?? value.duration_minutes),
    amountCents: Number(value.amountCents ?? value.amount_cents),
    currency: String(value.currency),
    status: value.status as Booking['status'],
    paymentStatus: paymentStatusOf(value.paymentStatus ?? value.payment_status),
    createdAt: new Date(String(value.createdAt ?? value.created_at)).toISOString(),
  };
}

export const fetchBookings = createAsyncThunk<BookingListItem[], string | undefined>(
  'bookings/fetchBookings',
  async (userId) => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const response = await api<ApiSuccess<BookingWire[]>>(`/api/booking/bookings${query}`);
    return response.data.map(normalizeBooking);
  },
);

export const createBooking = createAsyncThunk<BookingListItem, CreateBookingRequest & { userId?: string }>(
  'bookings/createBooking',
  async (request) => {
    const response = await api<ApiSuccess<BookingWire>>('/api/booking/bookings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return normalizeBooking(response.data);
  },
);

export const updateBooking = createAsyncThunk<BookingListItem, { id: string; machineId: string; startAt: string; durationMinutes: number }>(
  'bookings/updateBooking',
  async ({ id, ...body }) => {
    const response = await api<ApiSuccess<BookingWire>>(`/api/booking/bookings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return normalizeBooking(response.data);
  },
);

export const deleteBooking = createAsyncThunk<BookingListItem | string, string>(
  'bookings/deleteBooking',
  async (id) => {
    const response = await api<ApiSuccess<BookingWire> | null>(`/api/booking/bookings/${id}`, { method: 'DELETE' });
    return response?.data ? normalizeBooking(response.data) : id;
  },
);

const bookingsSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    clearCreateError(state) {
      state.createError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => {
        if (state.bookings.length === 0) state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.bookings = [...action.payload].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.error.message ?? 'Could not load bookings';
      })
      .addCase(createBooking.pending, (state) => {
        state.createStatus = 'loading';
        state.mutationStatus = 'loading';
        state.createError = null;
        state.mutationError = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.mutationStatus = 'succeeded';
        state.bookings.unshift(action.payload);
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.mutationStatus = 'failed';
        state.createError = action.error.message ?? 'Could not create booking';
        state.mutationError = state.createError;
      })
      .addCase(updateBooking.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(updateBooking.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.bookings = state.bookings.map((booking) => (
          booking.id === action.payload.id ? action.payload : booking
        ));
      })
      .addCase(updateBooking.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.error.message ?? 'Could not update booking';
      })
      .addCase(deleteBooking.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(deleteBooking.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        const removedId = typeof action.payload === 'string' ? action.payload : null;
        const cancelled = typeof action.payload === 'string' ? null : action.payload;
        if (removedId) {
          state.bookings = state.bookings.filter((booking) => booking.id !== removedId);
        } else if (cancelled) {
          state.bookings = state.bookings.map((booking) => (
            booking.id === cancelled.id ? cancelled : booking
          ));
        }
      })
      .addCase(deleteBooking.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.error.message ?? 'Could not delete booking';
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearCreateError } = bookingsSlice.actions;
export default bookingsSlice.reducer;
