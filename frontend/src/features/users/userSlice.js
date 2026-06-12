import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as userService from './userService';

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
  filters: { name: '', email: '' },
  listLoading: false,
  listError: null,
  submitLoading: false,
  submitError: null,
};

const getErrorMessage = (error) =>
  error.response?.data?.message || error.message || 'Something went wrong';

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (query = {}, { getState, rejectWithValue }) => {
    try {
      const { users } = getState();

      return await userService.getUsers({
        name: query.name !== undefined ? query.name : users.filters.name,
        email: query.email !== undefined ? query.email : users.filters.email,
        page_size: query.page_size ?? users.pagination.page_size,
        current_page: query.current_page ?? users.pagination.current_page,
      });
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await userService.createUser(payload);

      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to create user');
      }

      dispatch(setPage(1));
      await dispatch(fetchUsers());

      return response.data.user;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      const response = await userService.updateUser(payload);

      if (!response.success) {
        return rejectWithValue(response.message || 'Failed to update user');
      }

      await dispatch(fetchUsers());

      return response.data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = {
        name: action.payload.name ?? '',
        email: action.payload.email ?? '',
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
      .addCase(fetchUsers.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
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
      .addCase(fetchUsers.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })
      .addCase(createUser.pending, (state) => {
        state.submitLoading = true;
        state.submitError = null;
      })
      .addCase(createUser.fulfilled, (state) => {
        state.submitLoading = false;
      })
      .addCase(createUser.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      })
      .addCase(updateUser.pending, (state) => {
        state.submitLoading = true;
        state.submitError = null;
      })
      .addCase(updateUser.fulfilled, (state) => {
        state.submitLoading = false;
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.submitLoading = false;
        state.submitError = action.payload;
      });
  },
});

export const { setFilters, setPage, setPageSize, clearSubmitError, clearListError } = userSlice.actions;
export default userSlice.reducer;
