import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Alert,
  Box,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { CustomButton, CustomDialog, TextField as FormTextField } from '../components';
import {
  clearSubmitError,
  createUser,
  fetchUsers,
  setFilters,
  setPage,
  setPageSize,
  updateUser,
} from '../features/users/userSlice';
import {
  selectUserFilters,
  selectUserList,
  selectUserPagination,
  selectUsersError,
  selectUsersLoading,
  selectUsersSubmitError,
  selectUsersSubmitLoading,
} from '../features/users/userSelectors';
import { useAppDispatch, useAppSelector } from '../store/hooks';

const emptyForm = { name: '', email: '', password: '' };

const formatDate = (value) => {
  if (!value) {
    return '-';
  }
  return value;
};

const UserCard = ({ user, onEdit }) => (
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
      {user.name}
    </Typography>

    <Chip
      label={user.email}
      size="small"
      sx={{
        alignSelf: 'flex-start',
        mb: 2,
        bgcolor: '#f4f4f5',
        color: '#52525b',
        fontWeight: 500,
        borderRadius: 1,
        maxWidth: '100%',
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }}
    />

    <Grid container spacing={2} sx={{ flexGrow: 1 }}>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Status
        </Typography>
        <Chip
          label="Active"
          size="small"
          sx={{
            mt: 0.5,
            bgcolor: '#dcfce7',
            color: '#166534',
            fontWeight: 600,
            borderRadius: 1,
          }}
        />
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Created By
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {user.insert_by_val || '-'}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Created At
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {formatDate(user.insert_datetime)}
        </Typography>
      </Grid>
      <Grid item xs={6}>
        <Typography variant="caption" color="text.secondary" display="block">
          Updated By
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {user.update_by_val || '-'}
        </Typography>
      </Grid>
      <Grid item xs={12}>
        <Typography variant="caption" color="text.secondary" display="block">
          Updated At
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {formatDate(user.update_datetime)}
        </Typography>
      </Grid>
    </Grid>

    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
      <IconButton size="small" onClick={() => onEdit(user)} aria-label="Edit user">
        <EditOutlinedIcon fontSize="small" />
      </IconButton>
    </Box>
  </Paper>
);

const UserList = () => {
  const dispatch = useAppDispatch();
  const users = useAppSelector(selectUserList);
  const pagination = useAppSelector(selectUserPagination);
  const listLoading = useAppSelector(selectUsersLoading);
  const listError = useAppSelector(selectUsersError);
  const submitLoading = useAppSelector(selectUsersSubmitLoading);
  const submitError = useAppSelector(selectUsersSubmitError);
  const savedFilters = useAppSelector(selectUserFilters);

  const [nameFilter, setNameFilter] = useState(savedFilters.name);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const handleSearch = () => {
    const name = nameFilter.trim();
    dispatch(setFilters({ name, email: '' }));
    dispatch(fetchUsers({ name, email: '', current_page: 1 }));
  };

  const handleOpenCreate = () => {
    dispatch(clearSubmitError());
    setEditUser(null);
    setForm(emptyForm);
    setFieldErrors({});
    setFormDialogOpen(true);
  };

  const handleOpenEdit = useCallback((user) => {
    dispatch(clearSubmitError());
    setEditUser(user);
    setForm({ name: user.name, email: user.email, password: '' });
    setFieldErrors({});
    setFormDialogOpen(true);
  }, [dispatch]);

  const handleCloseForm = () => {
    setFormDialogOpen(false);
    setEditUser(null);
    setForm(emptyForm);
    setFieldErrors({});
    dispatch(clearSubmitError());
  };

  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name = 'Name is required';
    } else if (form.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    if (!form.email.trim()) {
      errors.email = 'Email is required';
    }

    if (!editUser && !form.password) {
      errors.password = 'Password is required';
    } else if (form.password && form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    if (editUser) {
      const payload = { id: editUser.id };

      if (form.name.trim() !== editUser.name) {
        payload.name = form.name.trim();
      }
      if (form.email.trim() !== editUser.email) {
        payload.email = form.email.trim();
      }
      if (form.password) {
        payload.password = form.password;
      }

      if (!payload.name && !payload.email && !payload.password) {
        handleCloseForm();
        return;
      }

      const result = await dispatch(updateUser(payload));
      if (updateUser.fulfilled.match(result)) {
        handleCloseForm();
      }
      return;
    }

    const result = await dispatch(
      createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })
    );

    if (createUser.fulfilled.match(result)) {
      handleCloseForm();
    }
  };

  const handlePageChange = (_, newPage) => {
    dispatch(setPage(newPage + 1));
    dispatch(fetchUsers());
  };

  const handleRowsPerPageChange = (event) => {
    dispatch(setPageSize(parseInt(event.target.value, 10)));
    dispatch(fetchUsers());
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
            Manage Users
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
              placeholder="Filter by username"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              sx={{ minWidth: 220 }}
            />
            <CustomButton
              buttonType="outline"
              label="Search"
              onClick={handleSearch}
              loading={listLoading}
            />
            <CustomButton
              buttonType="primary"
              label="Add User"
              onClick={handleOpenCreate}
            />
          </Box>
        </Box>

        {listError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {listError}
          </Alert>
        )}

        {listLoading && users.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">Loading users...</Typography>
          </Box>
        ) : users.length === 0 ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">No users found.</Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {users.map((user) => (
              <Grid item xs={12} sm={6} md={4} key={user.id}>
                <UserCard user={user} onEdit={handleOpenEdit} />
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
        title={editUser ? 'Edit User' : 'Add User'}
        subtitle={
          editUser
            ? 'Update user details. Leave password blank to keep the current password.'
            : 'Create a new user account.'
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

        <Stack spacing={2}>
          <FormTextField
            label="Name"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            required
            error={Boolean(fieldErrors.name)}
            helperText={fieldErrors.name}
          />
          <FormTextField
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
            required
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
          />
          <FormTextField
            label={editUser ? 'Password (optional)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(value) => setForm((prev) => ({ ...prev, password: value }))}
            required={!editUser}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password}
            autoComplete="new-password"
          />
        </Stack>
      </CustomDialog>
    </>
  );
};

export default UserList;
