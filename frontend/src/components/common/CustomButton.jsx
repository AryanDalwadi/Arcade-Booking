import { Button as MuiButton, CircularProgress } from '@mui/material';

const BUTTON_PRESETS = {
  primary: { variant: 'contained', color: 'primary' },
  secondary: { variant: 'contained', color: 'secondary' },
  outline: { variant: 'outlined', color: 'primary' },
  text: { variant: 'text', color: 'primary' },
  cancel: { variant: 'outlined', color: 'inherit' },
  save: { variant: 'contained', color: 'primary' },
  delete: { variant: 'contained', color: 'error' },
  confirm: { variant: 'contained', color: 'primary' },
};

const CustomButton = ({
  children,
  label,
  onClick,
  buttonType,
  variant,
  color,
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  startIcon,
  endIcon,
  show = true,
}) => {
  if (!show) {
    return null;
  }

  const preset = buttonType ? BUTTON_PRESETS[buttonType] : {};
  const text = children ?? label;

  return (
    <MuiButton
      type={type}
      onClick={onClick}
      variant={variant || preset.variant || 'contained'}
      color={color || preset.color || 'primary'}
      size={size}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      startIcon={loading ? null : startIcon}
      endIcon={loading ? null : endIcon}
    >
      {loading ? (
        <>
          <CircularProgress size={18} color="inherit" sx={{ mr: text ? 1 : 0 }} />
          {text}
        </>
      ) : (
        text
      )}
    </MuiButton>
  );
};

export default CustomButton;
