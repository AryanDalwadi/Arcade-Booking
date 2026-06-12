import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { AllDropdown, CustomButton, CustomDialog, TextField as FormTextField } from '../components';
import {
  clearSubmitError,
  createUserGroup,
  fetchUserGroups,
  setFilters,
  setPage,
  setPageSize,
  updateUserGroup,
} from '../features/userGroups/userGroupSlice';
import {
  selectUserGroupFilters,
  selectUserGroupList,
  selectUserGroupPagination,
  selectUserGroupsError,
  selectUserGroupsLoading,
  selectUserGroupsSubmitError,
  selectUserGroupsSubmitLoading,
} from '../features/userGroups/userGroupSelectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const STATUS_ACTIVE = 1;
const STATUS_INACTIVE = 2;

const statusFilterOptions = [
  { value: '1', label: 'Active' },
  { value: '2', label: 'Inactive' },
];

const emptyForm = { group_name: '', sys_admin: false, status: true };

const formatDate = (value) => value || '-';

const isActive = (status) => Number(status) === STATUS_ACTIVE;

const getStatusLabel = (status) => (isActive(status) ? 'Active' : 'Inactive');

const UserGroupCard = ({ group, onEdit }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 2.5,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      borderRadius: 2,
      borderColor: '#e4e4e7',
    }}
  >
    <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
      {group.group_name}
    </Typography>

    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
      <Chip
        label={group.sys_admin ? 'Sys Admin' : 'Standard'}
        size="small"
        sx={{
          bgcolor: group.sys_admin ? '#dbeafe' : '#f4f4f5',
          color: group.sys_admin ? '#1e40af' : '#52525b',
          fontWeight: 600,
          borderRadius: 1,
        }}
      />
      <Chip
        label={getStatusLabel(group.status)}
        size="small"
        sx={{
          bgcolor: isActive(group.status) ? '#dcfce7' : '#fee2e2',
          color: isActive(group.status) ? '#166534' : '#991b1b',
          fontWeight: 600,
          borderRadius: 1,
        }}
      />
    </Box>

    <Grid container spacing={2} sx={{ flexGrow: 1 }}>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Created By
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {group.insert_by_val || '-'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Created At
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {formatDate(group.insert_datetime)}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Updated By
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {group.update_by_val || '-'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="caption" color="text.secondary" display="block">
          Updated At
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {formatDate(group.update_datetime)}
        </Typography>
      </Grid>
    </Grid>

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <IconButton size="small" onClick={() => onEdit(group)} aria-label="Edit user group">
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
    </Box>
  </Paper>
);

const UserGroupList = () => {
  const dispatch = useAppDispatch();
  const groups = useAppSelector(selectUserGroupList);
  const pagination = useAppSelector(selectUserGroupPagination);
  const listLoading = useAppSelector(selectUserGroupsLoading);
  const listError = useAppSelector(selectUserGroupsError);
  const submitLoading = useAppSelector(selectUserGroupsSubmitLoading);
  const submitError = useAppSelector(selectUserGroupsSubmitError);
  const savedFilters = useAppSelector(selectUserGroupFilters);

  const [groupNameFilter, setGroupNameFilter] = useState(savedFilters.group_name);
  const [statusFilter, setStatusFilter] = useState(savedFilters.status);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    dispatch(fetchUserGroups());
  }, [dispatch]);

  const handleSearch = () => {
    const group_name = groupNameFilter.trim();
    dispatch(setFilters({ group_name, status: statusFilter }));
    dispatch(fetchUserGroups({ group_name, status: statusFilter, current_page: 1 }));
  };

  const handleOpenCreate = () => {
    dispatch(clearSubmitError());
    setEditGroup(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormDialogOpen(true);
  };

  const handleOpenEdit = useCallback(
    (group) => {
      dispatch(clearSubmitError());
      setEditGroup(group);
      setForm({
        group_name: group.group_name,
        sys_admin: Boolean(group.sys_admin),
        status: isActive(group.status),
      });
      setFieldErrors({});
      setFormDialogOpen(true);
    },
    [dispatch]
  );

  const handleCloseForm = () => {
    setFormDialogOpen(false);
    setEditGroup(null);
    setForm(emptyForm);
    setFieldErrors({});
    dispatch(clearSubmitError());
  };

  const validateForm = () => {
    const errors = {};

    if (!form.group_name.trim()) {
      errors.group_name = 'Group name is required';
    } else if (form.group_name.trim().length > 100) {
      errors.group_name = 'Group name must be 100 characters or less';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toStatusValue = (isActiveStatus) => (isActiveStatus ? STATUS_ACTIVE : STATUS_INACTIVE);

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    const statusValue = toStatusValue(form.status);

    if (editGroup) {
      const payload = { id: editGroup.id };

      if (form.group_name.trim() !== editGroup.group_name) {
        payload.group_name = form.group_name.trim();
      }
      if (Boolean(form.sys_admin) !== Boolean(editGroup.sys_admin)) {
        payload.sys_admin = form.sys_admin;
      }
      if (statusValue !== Number(editGroup.status)) {
        payload.status = statusValue;
      }

      if (!payload.group_name && payload.sys_admin === undefined && payload.status === undefined) {
        handleCloseForm();
        return;
      }

      const result = await dispatch(updateUserGroup(payload));
      if (updateUserGroup.fulfilled.match(result)) {
        handleCloseForm();
      }
      return;
    }

    const result = await dispatch(
      createUserGroup({
        group_name: form.group_name.trim(),
        sys_admin: form.sys_admin,
        status: statusValue,
      })
    );

    if (createUserGroup.fulfilled.match(result)) {
      handleCloseForm();
    }
  };

  const handlePageChange = (_, newPage) => {
    dispatch(setPage(newPage + 1));
    dispatch(fetchUserGroups());
  };

  const handleRowsPerPageChange = (event) => {
    dispatch(setPageSize(parseInt(event.target.value, 10)));
    dispatch(fetchUserGroups());
  };

  const rangeStart =
    pagination.total_count === 0
      ? 0
      : (pagination.current_page - 1) * pagination.page_size + 1;
  const rangeEnd = Math.min(
    pagination.current_page * pagination.page_size,
    pagination.total_count
  );

  return (
    <>
      <Paper
        sx={{
          p: { xs: 2, sm: 3 },
          borderRadius: 3,
          border: '1px solid #e4e4e7',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h5" fontWeight={700}>
            User Groups
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              flexWrap: 'wrap',
              flex: 1,
              justifyContent: { xs: 'flex-start', md: 'flex-end' },
            }}
          >
            <TextField
              size="small"
              placeholder="Filter by group name"
              value={groupNameFilter}
              onChange={(e) => setGroupNameFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              sx={{ minWidth: 220 }}
            />
            <Box sx={{ minWidth: 160 }}>
              <AllDropdown
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={statusFilterOptions}
                allValue="0"
              />
            </Box>
            <CustomButton
              buttonType="outline"
              label="Search"
              onClick={handleSearch}
              loading={listLoading}
            />
            <CustomButton buttonType="primary" label="Add Group" onClick={handleOpenCreate} />
          </Box>
        </Box>

        {listError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {listError}
          </Alert>
        )}

        {listLoading && groups.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">Loading user groups...</Typography>
          </Box>
        ) : groups.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No user groups found.</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {groups.map((group) => (
              <Grid item xs={12} sm={6} md={4} key={group.id}>
                <UserGroupCard group={group} onEdit={handleOpenEdit} />
              </Grid>
            ))}
          </Grid>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            mt: 2,
            borderTop: '1px solid #e4e4e7',
            pt: 1,
          }}
        >
          <TablePagination
            component="div"
            count={pagination.total_count}
            page={Math.max(0, pagination.current_page - 1)}
            onPageChange={handlePageChange}
            rowsPerPage={pagination.page_size}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 20]}
            labelDisplayedRows={() => `${rangeStart}–${rangeEnd} of ${pagination.total_count}`}
            sx={{
              border: 'none',
              '& .MuiTablePagination-toolbar': { pr: 0 },
            }}
          />
        </Box>
      </Paper>

      <CustomDialog
        open={formDialogOpen}
        onClose={handleCloseForm}
        title={editGroup ? 'Edit User Group' : 'Add User Group'}
        subtitle={
          editGroup
            ? 'Update user group details.'
            : 'Create a new user group with permissions and status.'
        }
        actions={{
          cancel: { show: true, onClick: handleCloseForm, disabled: submitLoading },
          save: {
            show: true,
            onClick: handleSave,
            loading: submitLoading,
            disabled: submitLoading,
          },
        }}
      >
        {submitError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {submitError}
          </Alert>
        )}

        <Stack spacing={1}>
          <FormTextField
            label="Group Name"
            value={form.group_name}
            onChange={(value) => setForm((prev) => ({ ...prev, group_name: value }))}
            required
            error={Boolean(fieldErrors.group_name)}
            helperText={fieldErrors.group_name}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={form.sys_admin}
                onChange={(e) => setForm((prev) => ({ ...prev, sys_admin: e.target.checked }))}
              />
            }
            label="System Admin"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.checked }))}
              />
            }
            label="Active"
          />
        </Stack>
      </CustomDialog>
    </>
  );
};

export default UserGroupList;
