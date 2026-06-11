import { TextField as MuiTextField } from '@mui/material';

const TextField = ({
  label,
  value,
  onChange,
  name,
  type = 'text',
  placeholder,
  fullWidth = true,
  size = 'small',
  disabled = false,
  required = false,
  error = false,
  helperText,
  multiline = false,
  rows = 3,
  inputProps,
  InputProps,
  autoComplete,
}) => (
  <MuiTextField
    label={label}
    name={name}
    type={type}
    placeholder={placeholder}
    value={value ?? ''}
    onChange={(event) => onChange(event.target.value)}
    fullWidth={fullWidth}
    size={size}
    disabled={disabled}
    required={required}
    error={error}
    helperText={helperText}
    multiline={multiline}
    rows={multiline ? rows : undefined}
    inputProps={inputProps}
    InputProps={InputProps}
    autoComplete={autoComplete}
  />
);

export default TextField;
