import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import CustomButton from '../common/CustomButton';

const ACTION_DEFAULTS = {
  cancel: { label: 'Cancel', color: 'inherit', variant: 'outlined' },
  confirm: { label: 'Confirm', color: 'primary', variant: 'contained' },
  save: { label: 'Save', color: 'primary', variant: 'contained' },
  delete: { label: 'Delete', color: 'error', variant: 'contained' },
};

const CustomDialog = ({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions = {},
  maxWidth = 'sm',
  fullWidth = true,
  disableBackdropClick = false,
}) => {
  const visibleActions = Object.entries(ACTION_DEFAULTS).filter(
    ([key]) => actions[key]?.show === true && actions[key]?.onClick
  );

  const handleClose = (_, reason) => {
    if (disableBackdropClick && reason === 'backdropClick') {
      return;
    }
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={maxWidth}
      fullWidth={fullWidth}
    >
      {title && <DialogTitle>{title}</DialogTitle>}

      {(subtitle || children) && (
        <DialogContent>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: children ? 2 : 0 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </DialogContent>
      )}

      {visibleActions.length > 0 && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {visibleActions.map(([key, defaults]) => {
            const action = actions[key];

            return (
              <CustomButton
                key={key}
                label={action.label || defaults.label}
                onClick={action.onClick}
                color={action.color || defaults.color}
                variant={action.variant || defaults.variant}
                disabled={action.disabled}
                loading={action.loading}
              />
            );
          })}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default CustomDialog;
