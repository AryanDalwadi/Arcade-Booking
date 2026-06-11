import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import {
  AllDropdown,
  AutoDropdown,
  CardList,
  CustomButton,
  CustomDialog,
  DateMonthYearPicker,
  DatePickerField,
  DateTimePickerField,
  PageHeader,
  TextField,
  TimePickerField,
} from '../components';

const statusOptions = [
  { value: '1', label: 'Active' },
  { value: '2', label: 'Inactive' },
];

const userOptions = [
  { value: 1, label: 'Aryan Patel' },
  { value: 2, label: 'Rahul Sharma' },
  { value: 3, label: 'Frontend Test' },
];

const ProductList = () => {
  const [status, setStatus] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [dateParts, setDateParts] = useState({ day: '', month: '', year: '' });
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleDeleteClick = (item) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    setDeleteDialogOpen(false);
    setSelectedItem(null);
  };

  const sampleItems = useMemo(
    () => [
      {
        id: 1,
        title: 'Floor Access (With Lift)',
        subtitle: 'FLOOR',
        fields: [
          { label: 'Base Price', value: '₹20' },
          { label: 'Status', value: 'Active' },
        ],
        actions: {
          edit: { show: true, onClick: () => setFormDialogOpen(true) },
          delete: { show: true, onClick: handleDeleteClick },
          view: { show: true, onClick: () => setFormDialogOpen(true) },
          pdfDownload: { show: true, onClick: () => window.alert('Download PDF item 1') },
        },
      },
      {
        id: 2,
        title: 'Loading & Unloading',
        subtitle: 'LABOUR',
        fields: [
          { label: 'Base Price', value: '₹50' },
          { label: 'Status', value: 'Active' },
        ],
        actions: {
          edit: { show: true, onClick: () => setFormDialogOpen(true) },
          view: { show: true, onClick: () => setFormDialogOpen(true) },
          pdfDownload: { show: false },
          delete: { show: true, onClick: handleDeleteClick },
        },
      },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Product List"
        subtitle="Custom components demo with card list and form controls."
      />

      <Paper sx={{ p: 3, mb: 3 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 240, flex: 1 }}>
              <TextField
                label="Product Name"
                value={productName}
                onChange={setProductName}
                placeholder="Enter product name"
              />
            </Box>
            <Box sx={{ minWidth: 240, flex: 1 }}>
              <TextField
                label="Description"
                value={description}
                onChange={setDescription}
                multiline
                rows={2}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 200, flex: 1 }}>
              <AllDropdown
                label="Status"
                value={status}
                onChange={setStatus}
                options={statusOptions}
              />
            </Box>
            <Box sx={{ minWidth: 260, flex: 1 }}>
              <AutoDropdown
                label="Search User"
                options={userOptions}
                value={selectedUser}
                onChange={setSelectedUser}
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ minWidth: 200, flex: 1 }}>
              <DatePickerField value={selectedDate} onChange={setSelectedDate} />
            </Box>
            <Box sx={{ minWidth: 200, flex: 1 }}>
              <TimePickerField value={selectedTime} onChange={setSelectedTime} />
            </Box>
            <Box sx={{ minWidth: 240, flex: 1 }}>
              <DateTimePickerField
                value={selectedDateTime}
                onChange={setSelectedDateTime}
              />
            </Box>
          </Box>

          <DateMonthYearPicker value={dateParts} onChange={setDateParts} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <CustomButton
              buttonType="primary"
              label="Open Form Dialog"
              onClick={() => setFormDialogOpen(true)}
            />
            <CustomButton buttonType="outline" label="Outline" />
            <CustomButton buttonType="cancel" label="Cancel" />
            <CustomButton buttonType="delete" label="Delete" />
            <CustomButton buttonType="save" label="Save" loading />
            <CustomButton buttonType="primary" label="Hidden" show={false} />
          </Box>
        </Stack>
      </Paper>

      <Divider sx={{ mb: 3 }} />

      <CardList items={sampleItems} />

      <CustomDialog
        open={formDialogOpen}
        onClose={() => setFormDialogOpen(false)}
        title="Add Product"
        subtitle="Fill in the product details below."
        actions={{
          cancel: { show: true, onClick: () => setFormDialogOpen(false) },
          save: { show: true, onClick: () => setFormDialogOpen(false) },
        }}
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="Product Name"
            value={productName}
            onChange={setProductName}
          />
          <TextField
            label="Description"
            value={description}
            onChange={setDescription}
            multiline
            rows={3}
          />
        </Stack>
      </CustomDialog>

      <CustomDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete Product"
        subtitle="This action cannot be undone."
        disableBackdropClick
        actions={{
          cancel: { show: true, onClick: () => setDeleteDialogOpen(false) },
          delete: { show: true, onClick: handleDeleteConfirm },
        }}
      >
        <Typography variant="body1">
          Are you sure you want to delete{' '}
          <strong>{selectedItem?.title}</strong>?
        </Typography>
      </CustomDialog>
    </>
  );
};

export default ProductList;
