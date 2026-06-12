export const selectUserGroupList = (state) => state.userGroups.list;

export const selectUserGroupPagination = (state) => state.userGroups.pagination;

export const selectUserGroupFilters = (state) => state.userGroups.filters;

export const selectUserGroupsLoading = (state) => state.userGroups.listLoading;

export const selectUserGroupsSubmitLoading = (state) => state.userGroups.submitLoading;

export const selectUserGroupsError = (state) => state.userGroups.listError;

export const selectUserGroupsSubmitError = (state) => state.userGroups.submitError;
