import { Paper, Typography } from '@mui/material';
import PageHeader from '../components/common/PageHeader';

const PurchaseScreen = () => (
  <>
    <PageHeader
      title="Purchase Screen"
      subtitle="Record and track purchase transactions."
    />
    <Paper sx={{ p: 3 }}>
      <Typography variant="body1">
        Purchase screen — API integration coming soon.
      </Typography>
    </Paper>
  </>
);

export default PurchaseScreen;
