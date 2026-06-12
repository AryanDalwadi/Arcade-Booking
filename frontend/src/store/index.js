import { configureStore } from '@reduxjs/toolkit';
import userReducer from '../features/users/userSlice';
import userGroupReducer from '../features/userGroups/userGroupSlice';

const store = configureStore({
  reducer: {
    users: userReducer,
    userGroups: userGroupReducer,
  },
});

export default store;
