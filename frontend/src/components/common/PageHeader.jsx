import { Box, Typography } from '@mui/material';

const PageHeader = ({ title, subtitle }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h4" component="h1" gutterBottom>
      {title}
    </Typography>
    {subtitle && (
      <Typography variant="body1" color="text.secondary">
        {subtitle}
      </Typography>
    )}
  </Box>
);

export default PageHeader;
