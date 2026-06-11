import { Autocomplete, TextField } from '@mui/material';
import { useMemo, useState } from 'react';

const AutoDropdown = ({
  label,
  options = [],
  value,
  onChange,
  getOptionLabel = (option) => option?.label || '',
  isOptionEqualToValue = (option, selected) => option?.value === selected?.value,
  minChars = 2,
  fullWidth = true,
  size = 'small',
  disabled = false,
  placeholder = 'Type at least 2 characters',
  noOptionsText = 'No options',
}) => {
  const [inputValue, setInputValue] = useState('');

  const filteredOptions = useMemo(() => {
    if (inputValue.trim().length < minChars) {
      return [];
    }

    const search = inputValue.trim().toLowerCase();

    return options.filter((option) =>
      getOptionLabel(option).toLowerCase().includes(search)
    );
  }, [options, inputValue, minChars, getOptionLabel]);

  return (
    <Autocomplete
      fullWidth={fullWidth}
      size={size}
      disabled={disabled}
      options={filteredOptions}
      value={value}
      onChange={(_, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
      getOptionLabel={getOptionLabel}
      isOptionEqualToValue={isOptionEqualToValue}
      noOptionsText={
        inputValue.trim().length < minChars
          ? `Type ${minChars} or more letters`
          : noOptionsText
      }
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder} />
      )}
    />
  );
};

export default AutoDropdown;
