import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as userGroupService from './userGroupService';

const initialPagination = {
  current_page: 1,
  total_count: 0,
  has_more: false,
  page_size: 10,
  total_page: 0,
};

const initialState = {
  list: [],
  pagination: initialPagination,
  filters: { group_name: '', status: '0' },
  listLoading: false,
  listError: null,
  submitLoading: false,
  submitError: null,
};

const getErrorMessage = (error) =>
  error.response?.data?.message || error.message || 'Something went wrong';

export const fetchUserGroups = createAsyncThunk(
  'userGroups/fetchUserGroups',
  async (query = {}, { getState, rejectWithValue }) => {
    try {
      const { userGroups } = getState();

      const status = query.status !== undefined ? query.status : userGroups.filters.status;

      return await userGroupService.getUserGroups({
        group_name:
          query.group_name !== undefined ? query.group_name : userGroups.filters.group_name,
        status: Number(status || 0),
        page_size: query.page_size ?? userGroups.pagination.page_size,
        current_page: query.current_page ?? userGroups.pagination.current_page,
      });
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createUserGroup = createAsyncThunk(
  'userGroups/createUserGroup',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await userGroupService.createUserGroup(payload);

      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to create user group');
      }

      dispatch(setPage(1));
      await dispatch(fetchUserGroups());

      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateUserGroup = createAsyncThunk(
  'userGroups/updateUserGroup',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await userGroupService.updateUserGroup(payload);

      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to update user group');
      }

      await dispatch(fetchUserGroups());

      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

const userGroupSlice = createSlice({
  name: 'userGroups',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = {
        group_name: action.payload.group_name ?? '',
        status: action.payload.status ?? '0',
      };
      state.pagination.current_page = 1;
    },
    setPage(state, action) {
      state.pagination.current_page = action.payload;
    },
    setPageSize(state, action) {
      state.pagination.page_size = action.payload;
      state.pagination.current_page = 1;
    },
    clearSubmitError(state) {
      state.submitError = null;
    },
    clearListError(state) {
      state.listError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserGroups.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchUserGroups.fulfilled, (state, action) => {
        state.listLoading = false;
        state.list = action.payload.data ?? [];
        state.pagination = {
          current_page: action.payload.current_page,
          total_count: action.payload.total_count,
          has_more: action.payload.has_more,
          page_size: action.payload.page_size,
          total_page: action.payload.total_page,
        };
      })
      .addCase(fetchUserGroups.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })
      .addCase(createUserGroup.pending, (state) => {
        state.submitLoading = true;
        state.submitError = null;
      })
      .addCase(createUserGroup.fulfilled, (state) => {
        state.submitLoading = false;
      })
      .addCase(createUserGroup.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      })
      .addCase(updateUserGroup.pending, (state) => {
        state.submitLoading = true;
        state.submitError = null;
      })
      .addCase(updateUserGroup.fulfilled, (state) => {
        state.submitLoading = false;
      })
      .addCase(updateUserGroup.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      });
  },
});

export const { setFilters, setPage, setPageSize, clearSubmitError, clearListError } =
  userGroupSlice.actions;
export default userGroupSlice.reducer;
