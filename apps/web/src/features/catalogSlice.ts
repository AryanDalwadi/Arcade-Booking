import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, Machine } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

type CatalogState = {
  machines: Machine[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  mutationStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  mutationError: string | null;
};

const initialState: CatalogState = {
  machines: [],
  status: 'idle',
  mutationStatus: 'idle',
  error: null,
  mutationError: null,
};

export const fetchMachines = createAsyncThunk<Machine[]>('catalog/fetchMachines', async () => {
  const response = await api<ApiSuccess<Machine[]>>('/api/catalog/machines');
  return response.data;
});

export const createMachineWithPricing = createAsyncThunk<
  Machine,
  { name: string; status: Machine['status']; pricePerHourCents: number; currency: string }
>('catalog/createMachineWithPricing', async (input) => {
  const machine = await api<ApiSuccess<Machine>>('/api/catalog/machines', {
    method: 'POST',
    body: JSON.stringify({ name: input.name, status: input.status }),
  });
  await api<ApiSuccess<unknown>>(`/api/catalog/pricing/${machine.data.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      pricePerHourCents: input.pricePerHourCents,
      currency: input.currency,
    }),
  });
  return machine.data;
});

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMachines.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchMachines.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.machines = action.payload;
      })
      .addCase(fetchMachines.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message ?? 'Could not load machines';
      })
      .addCase(createMachineWithPricing.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(createMachineWithPricing.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.machines.push(action.payload);
      })
      .addCase(createMachineWithPricing.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.error.message ?? 'Could not create machine';
      })
      .addCase(logout, () => initialState);
  },
});

export default catalogSlice.reducer;
