import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import authReducer from './features/authSlice';
import bookingsReducer from './features/bookingsSlice';
import catalogReducer from './features/catalogSlice';
import identityReducer from './features/identitySlice';

export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      identity: identityReducer,
      catalog: catalogReducer,
      bookings: bookingsReducer,
    },
  });
}

export const store = makeStore();
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
