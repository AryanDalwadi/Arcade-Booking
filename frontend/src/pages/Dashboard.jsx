import { Paper, Typography } from '@mui/material';
import PageHeader from '../components/common/PageHeader';
import useAuth from '../hooks/useAuth';

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Welcome to Arcade Booking management system."
      />
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1">
          Hello, {user?.name || 'User'}! Use the sidebar to navigate to Products,
          Billing, and Purchase screens.
        </Typography>
      </Paper>
    </>
  );
};

export default Dashboard;
