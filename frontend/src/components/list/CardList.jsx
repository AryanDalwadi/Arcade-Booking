import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';

const ACTION_CONFIG = {
  edit: { label: 'Edit', icon: EditOutlinedIcon, color: 'primary' },
  delete: { label: 'Delete', icon: DeleteOutlineIcon, color: 'error' },
  view: { label: 'View', icon: VisibilityOutlinedIcon, color: 'info' },
  pdfDownload: { label: 'Download PDF', icon: PictureAsPdfOutlinedIcon, color: 'secondary' },
};

const CardList = ({ items = [], emptyMessage = 'No records found.' }) => {
  if (!items.length) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {items.map((item) => {
        const visibleActions = Object.entries(ACTION_CONFIG).filter(
          ([key]) => item.actions?.[key]?.show === true && item.actions?.[key]?.onClick
        );

        return (
          <Grid item xs={12} sm={6} md={4} key={item.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="h3" gutterBottom>
                  {item.title}
                </Typography>
                {item.subtitle && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {item.subtitle}
                  </Typography>
                )}
                {item.fields?.map((field) => (
                  <Box key={`${item.id}-${field.label}`} sx={{ mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      {field.label}
                    </Typography>
                    <Typography variant="body2">{field.value ?? '-'}</Typography>
                  </Box>
                ))}
              </CardContent>

              {visibleActions.length > 0 && (
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  {visibleActions.map(([key, config]) => {
                    const Icon = config.icon;
                    const action = item.actions[key];

                    return (
                      <Tooltip key={key} title={action.label || config.label}>
                        <IconButton
                          color={action.color || config.color}
                          onClick={() => action.onClick(item)}
                          size="small"
                        >
                          <Icon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </CardActions>
              )}
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default CardList;
