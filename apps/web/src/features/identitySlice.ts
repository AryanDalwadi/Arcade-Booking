import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, User, UserGroup } from '@arcade/contracts';
import { api } from '../api';
import { logout } from './authSlice';

export const SYSTEM_GROUP_NAMES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export function isSystemGroupName(name: string): boolean {
  return SYSTEM_GROUP_NAMES.includes(name.toUpperCase() as typeof SYSTEM_GROUP_NAMES[number]);
}

type ResourceStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
type IdentityState = {
  users: User[];
  groups: UserGroup[];
  usersStatus: ResourceStatus;
  groupsStatus: ResourceStatus;
  saveStatus: ResourceStatus;
  usersError: string | null;
  groupsError: string | null;
  saveError: string | null;
};

const initialState: IdentityState = {
  users: [],
  groups: [],
  usersStatus: 'idle',
  groupsStatus: 'idle',
  saveStatus: 'idle',
  usersError: null,
  groupsError: null,
  saveError: null,
};

export const fetchUsers = createAsyncThunk<User[]>('identity/fetchUsers', async () => {
  const response = await api<ApiSuccess<User[]>>('/api/identity/users');
  return response.data;
});

export const fetchUserGroups = createAsyncThunk<UserGroup[]>('identity/fetchUserGroups', async () => {
  const response = await api<ApiSuccess<UserGroup[]>>('/api/identity/user-groups');
  return response.data;
});

export type UserGroupInput = {
  name: string;
  systemAdmin: boolean;
  active: boolean;
};

export const createUserGroup = createAsyncThunk<UserGroup, UserGroupInput>(
  'identity/createUserGroup',
  async (input) => {
    const response = await api<ApiSuccess<UserGroup>>('/api/identity/user-groups', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },
);

export const updateUserGroup = createAsyncThunk<
  UserGroup,
  { groupId: string } & Partial<UserGroupInput>
>(
  'identity/updateUserGroup',
  async ({ groupId, ...patch }) => {
    const response = await api<ApiSuccess<UserGroup>>(`/api/identity/user-groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.data;
  },
);

export const deleteUserGroup = createAsyncThunk<string, string>(
  'identity/deleteUserGroup',
  async (groupId) => {
    await api<void>(`/api/identity/user-groups/${groupId}`, { method: 'DELETE' });
    return groupId;
  },
);

type CreateUserInput = {
  email: string;
  password: string;
  displayName: string;
  active?: boolean;
};

export const createUser = createAsyncThunk<User, CreateUserInput>(
  'identity/createUser',
  async (input) => {
    const response = await api<ApiSuccess<User>>('/api/identity/users', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },
);

export const updateUser = createAsyncThunk<
  User,
  { id: string; displayName?: string; active?: boolean; password?: string }
>(
  'identity/updateUser',
  async ({ id, ...patch }) => {
    const response = await api<ApiSuccess<User>>(`/api/identity/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return response.data;
  },
);

export const setUserGroup = createAsyncThunk<User, { userId: string; groupId: string }>(
  'identity/setUserGroup',
  async ({ userId, groupId }) => {
    const response = await api<ApiSuccess<User>>(`/api/identity/users/${userId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ groupId }),
    });
    return response.data;
  },
);

export const deleteUser = createAsyncThunk<string, string>(
  'identity/deleteUser',
  async (id) => {
    await api<void>(`/api/identity/users/${id}`, { method: 'DELETE' });
    return id;
  },
);

const identitySlice = createSlice({
  name: 'identity',
  initialState,
  reducers: {
    clearSaveError(state) {
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.usersStatus = 'loading';
        state.usersError = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.usersStatus = 'succeeded';
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.usersStatus = 'failed';
        state.usersError = action.error.message ?? 'Could not load users';
      })
      .addCase(fetchUserGroups.pending, (state) => {
        state.groupsStatus = 'loading';
        state.groupsError = null;
      })
      .addCase(fetchUserGroups.fulfilled, (state, action) => {
        state.groupsStatus = 'succeeded';
        state.groups = action.payload;
      })
      .addCase(fetchUserGroups.rejected, (state, action) => {
        state.groupsStatus = 'failed';
        state.groupsError = action.error.message ?? 'Could not load user groups';
      })
      .addMatcher(
        (action) => [
          createUserGroup.pending.type,
          updateUserGroup.pending.type,
          deleteUserGroup.pending.type,
          createUser.pending.type,
          updateUser.pending.type,
          setUserGroup.pending.type,
          deleteUser.pending.type,
        ].includes(action.type),
        (state) => {
          state.saveStatus = 'loading';
          state.saveError = null;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof createUserGroup.fulfilled> =>
          action.type === createUserGroup.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          state.groups.push(action.payload);
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof updateUserGroup.fulfilled> =>
          action.type === updateUserGroup.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          const index = state.groups.findIndex((group) => group.id === action.payload.id);
          if (index >= 0) state.groups[index] = action.payload;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof deleteUserGroup.fulfilled> =>
          action.type === deleteUserGroup.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          state.groups = state.groups.filter((group) => group.id !== action.payload);
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof createUser.fulfilled> =>
          action.type === createUser.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          state.users.unshift(action.payload);
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof updateUser.fulfilled> | ReturnType<typeof setUserGroup.fulfilled> =>
          action.type === updateUser.fulfilled.type || action.type === setUserGroup.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          const index = state.users.findIndex((user) => user.id === action.payload.id);
          if (index >= 0) state.users[index] = action.payload;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof deleteUser.fulfilled> =>
          action.type === deleteUser.fulfilled.type,
        (state, action) => {
          state.saveStatus = 'succeeded';
          state.users = state.users.filter((user) => user.id !== action.payload);
        },
      )
      .addMatcher(
        (action): action is { type: string; error: { message?: string } } =>
          [
            createUserGroup.rejected.type,
            updateUserGroup.rejected.type,
            deleteUserGroup.rejected.type,
            createUser.rejected.type,
            updateUser.rejected.type,
            setUserGroup.rejected.type,
            deleteUser.rejected.type,
          ].includes(action.type),
        (state, action) => {
          state.saveStatus = 'failed';
          state.saveError = action.error.message ?? 'Request failed';
        },
      )
      .addMatcher(
        (action) => action.type === logout.type,
        () => initialState,
      );
  },
});

export const { clearSaveError } = identitySlice.actions;
export default identitySlice.reducer;
