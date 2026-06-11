import { Paper, Typography } from '@mui/material';
import PageHeader from '../components/common/PageHeader';

const BillingScreen = () => (
  <>
    <PageHeader
      title="Billing Screen"
      subtitle="Create and manage customer bills."
    />
    <Paper sx={{ p: 3 }}>
      <Typography variant="body1">
        Billing screen — API integration coming soon.
      </Typography>
    </Paper>
  </>
);

export default BillingScreen;
