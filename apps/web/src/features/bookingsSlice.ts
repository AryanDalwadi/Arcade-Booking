import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, Booking, CreateBookingRequest } from '@arcade/contracts';
import { api } from '../api';

type BookingState = {
  bookings: Booking[];
  listStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  createStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  listError: string | null;
  createError: string | null;
};

const initialState: BookingState = {
  bookings: [],
  listStatus: 'idle',
  createStatus: 'idle',
  listError: null,
  createError: null,
};

type BookingWire = Partial<Booking> & {
  user_id?: string;
  machine_id?: string;
  start_at?: string;
  duration_minutes?: number;
  amount_cents?: number;
  created_at?: string;
};

function normalizeBooking(value: BookingWire): Booking {
  return {
    id: String(value.id),
    userId: String(value.userId ?? value.user_id),
    machineId: String(value.machineId ?? value.machine_id),
    startAt: new Date(String(value.startAt ?? value.start_at)).toISOString(),
    durationMinutes: Number(value.durationMinutes ?? value.duration_minutes),
    amountCents: Number(value.amountCents ?? value.amount_cents),
    currency: String(value.currency),
    status: value.status as Booking['status'],
    createdAt: new Date(String(value.createdAt ?? value.created_at)).toISOString(),
  };
}

export const fetchBookings = createAsyncThunk<Booking[], string | undefined>(
  'bookings/fetchBookings',
  async (userId) => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const response = await api<ApiSuccess<BookingWire[]>>(`/api/booking/bookings${query}`);
    return response.data.map(normalizeBooking);
  },
);

export const createBooking = createAsyncThunk<Booking, CreateBookingRequest>(
  'bookings/createBooking',
  async (request) => {
    const response = await api<ApiSuccess<BookingWire>>('/api/booking/bookings', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return normalizeBooking(response.data);
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
        state.listStatus = 'loading';
        state.listError = null;
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.listStatus = 'succeeded';
        state.bookings = action.payload;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.listStatus = 'failed';
        state.listError = action.error.message ?? 'Could not load bookings';
      })
      .addCase(createBooking.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.bookings.unshift(action.payload);
      })
      .addCase(createBooking.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.error.message ?? 'Could not create booking';
      });
  },
});

export const { clearCreateError } = bookingsSlice.actions;
export default bookingsSlice.reducer;
