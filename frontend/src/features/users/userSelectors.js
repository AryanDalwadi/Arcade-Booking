export const selectUserList = (state) => state.users.list;

export const selectUserPagination = (state) => state.users.pagination;

export const selectUserFilters = (state) => state.users.filters;

export const selectUsersLoading = (state) => state.users.listLoading;

export const selectUsersSubmitLoading = (state) => state.users.submitLoading;

export const selectUsersError = (state) => state.users.listError;

export const selectUsersSubmitError = (state) => state.users.submitError;
