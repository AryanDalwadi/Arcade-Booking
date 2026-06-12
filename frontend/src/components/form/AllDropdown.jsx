import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';

const ALL_VALUE = '';

const AllDropdown = ({
  label,
  value,
  onChange,
  options = [],
  allLabel = 'All',
  allValue = ALL_VALUE,
  fullWidth = true,
  size = 'small',
  disabled = false,
  name,
}) => (
  <FormControl fullWidth={fullWidth} size={size} disabled={disabled}>
    <InputLabel id={`${name || label}-label`}>{label}</InputLabel>
    <Select
      labelId={`${name || label}-label`}
      id={name || label}
      label={label}
      value={value ?? allValue}
      onChange={(event) => onChange(event.target.value)}
    >
      <MenuItem value={allValue}>{allLabel}</MenuItem>
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  </FormControl>
);

export default AllDropdown;
export { ALL_VALUE };
