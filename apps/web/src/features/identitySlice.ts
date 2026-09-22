import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { ApiSuccess, User, UserGroup } from '@arcade/contracts';
import { api } from '../api';

type ResourceStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
type IdentityState = {
  users: User[];
  groups: UserGroup[];
  usersStatus: ResourceStatus;
  groupsStatus: ResourceStatus;
  createStatus: ResourceStatus;
  membershipStatus: ResourceStatus;
  usersError: string | null;
  groupsError: string | null;
  createError: string | null;
  membershipError: string | null;
};

const initialState: IdentityState = {
  users: [],
  groups: [],
  usersStatus: 'idle',
  groupsStatus: 'idle',
  createStatus: 'idle',
  membershipStatus: 'idle',
  usersError: null,
  groupsError: null,
  createError: null,
  membershipError: null,
};

export const fetchUsers = createAsyncThunk<User[]>('identity/fetchUsers', async () => {
  const response = await api<ApiSuccess<User[]>>('/api/identity/users');
  return response.data;
});

export const fetchUserGroups = createAsyncThunk<UserGroup[]>('identity/fetchUserGroups', async () => {
  const response = await api<ApiSuccess<UserGroup[]>>('/api/identity/user-groups');
  return response.data;
});

export const createUserGroup = createAsyncThunk<UserGroup, string>(
  'identity/createUserGroup',
  async (name) => {
    const response = await api<ApiSuccess<Pick<UserGroup, 'id' | 'name'>>>('/api/identity/user-groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return { ...response.data, members: [] };
  },
);

type Membership = { groupId: string; userId: string };
export const addGroupMember = createAsyncThunk<Membership, Membership>(
  'identity/addGroupMember',
  async (membership) => {
    await api<void>(
      `/api/identity/user-groups/${membership.groupId}/users/${membership.userId}`,
      { method: 'POST' },
    );
    return membership;
  },
);

export const removeGroupMember = createAsyncThunk<Membership, Membership>(
  'identity/removeGroupMember',
  async (membership) => {
    await api<void>(
      `/api/identity/user-groups/${membership.groupId}/users/${membership.userId}`,
      { method: 'DELETE' },
    );
    return membership;
  },
);

const identitySlice = createSlice({
  name: 'identity',
  initialState,
  reducers: {},
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
      .addCase(createUserGroup.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
      })
      .addCase(createUserGroup.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.groups.push(action.payload);
      })
      .addCase(createUserGroup.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.error.message ?? 'Could not create user group';
      })
      .addMatcher(
        (action) => action.type === addGroupMember.pending.type || action.type === removeGroupMember.pending.type,
        (state) => {
          state.membershipStatus = 'loading';
          state.membershipError = null;
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof addGroupMember.fulfilled> =>
          action.type === addGroupMember.fulfilled.type,
        (state, action) => {
          state.membershipStatus = 'succeeded';
          const group = state.groups.find((candidate) => candidate.id === action.payload.groupId);
          if (group && !group.members.includes(action.payload.userId)) group.members.push(action.payload.userId);
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof removeGroupMember.fulfilled> =>
          action.type === removeGroupMember.fulfilled.type,
        (state, action) => {
          state.membershipStatus = 'succeeded';
          const group = state.groups.find((candidate) => candidate.id === action.payload.groupId);
          if (group) group.members = group.members.filter((id) => id !== action.payload.userId);
        },
      )
      .addMatcher(
        (action): action is ReturnType<typeof addGroupMember.rejected> | ReturnType<typeof removeGroupMember.rejected> =>
          action.type === addGroupMember.rejected.type || action.type === removeGroupMember.rejected.type,
        (state, action) => {
          state.membershipStatus = 'failed';
          state.membershipError = action.error.message ?? 'Could not update group membership';
        },
      );
  },
});

export default identitySlice.reducer;
