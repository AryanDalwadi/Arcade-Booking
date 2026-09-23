import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, CheckoutOrder, ConfirmRazorpayPaymentRequest, NotificationDelivery } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

type WireDelivery = NotificationDelivery & {
  event_id?: string;
  event_type?: string;
  created_at?: string;
};

function normalizeDelivery(row: WireDelivery): NotificationDelivery {
  return {
    id: String(row.id),
    eventId: String(row.eventId ?? row.event_id),
    eventType: String(row.eventType ?? row.event_type),
    channel: String(row.channel),
    recipient: String(row.recipient),
    status: row.status,
    payload: row.payload,
    createdAt: row.createdAt ?? (row.created_at ? new Date(row.created_at).toISOString() : undefined),
  };
}

type PaymentsState = {
  payingBookingId: string | null;
  payError: string | null;
  deliveries: NotificationDelivery[];
  deliveriesStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  deliveriesError: string | null;
};

const initialState: PaymentsState = {
  payingBookingId: null,
  payError: null,
  deliveries: [],
  deliveriesStatus: 'idle',
  deliveriesError: null,
};

export const createCheckoutOrder = createAsyncThunk<CheckoutOrder, string>(
  'payments/createCheckoutOrder',
  async (bookingId) => {
    const response = await api<ApiSuccess<CheckoutOrder>>('/api/payment/orders', {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
    return response.data;
  },
);

export const simulateCheckout = createAsyncThunk<void, { bookingId: string; outcome: 'SUCCEED' | 'FAIL' }>(
  'payments/simulateCheckout',
  async ({ bookingId, outcome }) => {
    await api(`/api/payment/orders/${bookingId}/simulate`, {
      method: 'POST',
      body: JSON.stringify({ outcome }),
    });
  },
);

export const confirmRazorpayCheckout = createAsyncThunk<void, { bookingId: string } & ConfirmRazorpayPaymentRequest>(
  'payments/confirmRazorpayCheckout',
  async ({ bookingId, ...body }) => {
    await api(`/api/payment/orders/${bookingId}/confirm`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
);

export const fetchDeliveries = createAsyncThunk<NotificationDelivery[]>(
  'payments/fetchDeliveries',
  async () => {
    const response = await api<ApiSuccess<WireDelivery[]>>('/api/notification/deliveries');
    return response.data.map(normalizeDelivery);
  },
);

const paymentsSlice = createSlice({
  name: 'payments',
  initialState,
  reducers: {
    clearPayError(state) {
      state.payError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createCheckoutOrder.pending, (state, action) => {
        state.payingBookingId = action.meta.arg;
        state.payError = null;
      })
      .addCase(createCheckoutOrder.fulfilled, (state) => {
        state.payingBookingId = null;
      })
      .addCase(createCheckoutOrder.rejected, (state, action) => {
        state.payingBookingId = null;
        state.payError = action.error.message ?? 'Could not start checkout';
      })
      .addCase(simulateCheckout.rejected, (state, action) => {
        state.payError = action.error.message ?? 'Simulated capture failed';
      })
      .addCase(confirmRazorpayCheckout.rejected, (state, action) => {
        state.payError = action.error.message ?? 'Could not confirm Razorpay payment';
      })
      .addCase(fetchDeliveries.pending, (state) => {
        state.deliveriesStatus = 'loading';
        state.deliveriesError = null;
      })
      .addCase(fetchDeliveries.fulfilled, (state, action) => {
        state.deliveriesStatus = 'succeeded';
        state.deliveries = action.payload;
      })
      .addCase(fetchDeliveries.rejected, (state, action) => {
        state.deliveriesStatus = 'failed';
        state.deliveriesError = action.error.message ?? 'Could not load deliveries';
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearPayError } = paymentsSlice.actions;
export default paymentsSlice.reducer;
