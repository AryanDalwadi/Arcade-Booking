import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, CatalogMachine, Machine } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

type CatalogState = {
  machines: CatalogMachine[];
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

type MachineInput = {
  name: string;
  status: Machine['status'];
  pricePerHourCents: number;
  currency: string;
};

export const fetchMachines = createAsyncThunk<CatalogMachine[]>('catalog/fetchMachines', async () => {
  const response = await api<ApiSuccess<CatalogMachine[]>>('/api/catalog/machines');
  return response.data;
});

export const createMachineWithPricing = createAsyncThunk<CatalogMachine, MachineInput>(
  'catalog/createMachineWithPricing',
  async (input) => {
    const machine = await api<ApiSuccess<Machine>>('/api/catalog/machines', {
      method: 'POST',
      body: JSON.stringify({ name: input.name, status: input.status }),
    });
    const currency = input.currency.toUpperCase();
    await api<ApiSuccess<unknown>>(`/api/catalog/pricing/${machine.data.id}`, {
      method: 'PUT',
      body: JSON.stringify({ pricePerHourCents: input.pricePerHourCents, currency }),
    });
    return { ...machine.data, pricePerHourCents: input.pricePerHourCents, currency };
  },
);

export const updateMachineWithPricing = createAsyncThunk<CatalogMachine, MachineInput & { id: string }>(
  'catalog/updateMachineWithPricing',
  async (input) => {
    const currency = input.currency.toUpperCase();
    const machine = await api<ApiSuccess<Machine>>(`/api/catalog/machines/${input.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name: input.name, status: input.status }),
    });
    await api<ApiSuccess<unknown>>(`/api/catalog/pricing/${input.id}`, {
      method: 'PUT',
      body: JSON.stringify({ pricePerHourCents: input.pricePerHourCents, currency }),
    });
    return { ...machine.data, pricePerHourCents: input.pricePerHourCents, currency };
  },
);

export const deleteMachine = createAsyncThunk<string, string>('catalog/deleteMachine', async (id) => {
  await api<undefined>(`/api/catalog/machines/${id}`, { method: 'DELETE' });
  return id;
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
      .addCase(updateMachineWithPricing.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(updateMachineWithPricing.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.machines = state.machines.map((machine) => (
          machine.id === action.payload.id ? action.payload : machine
        ));
      })
      .addCase(updateMachineWithPricing.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.error.message ?? 'Could not update machine';
      })
      .addCase(deleteMachine.pending, (state) => {
        state.mutationStatus = 'loading';
        state.mutationError = null;
      })
      .addCase(deleteMachine.fulfilled, (state, action) => {
        state.mutationStatus = 'succeeded';
        state.machines = state.machines.filter((machine) => machine.id !== action.payload);
      })
      .addCase(deleteMachine.rejected, (state, action) => {
        state.mutationStatus = 'failed';
        state.mutationError = action.error.message ?? 'Could not delete machine';
      })
      .addCase(logout, () => initialState);
  },
});

export default catalogSlice.reducer;
