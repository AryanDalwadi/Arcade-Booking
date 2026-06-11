import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

const DatePickerField = ({
  label = 'Date',
  value,
  onChange,
  fullWidth = true,
  size = 'small',
  disabled = false,
  format = 'DD-MM-YYYY',
  minDate,
  maxDate,
}) => (
  <DatePicker
    label={label}
    value={value ? dayjs(value) : null}
    onChange={(newValue) => onChange(newValue ? newValue.toDate() : null)}
    format={format}
    disabled={disabled}
    minDate={minDate ? dayjs(minDate) : undefined}
    maxDate={maxDate ? dayjs(maxDate) : undefined}
    slotProps={{
      textField: {
        fullWidth,
        size,
      },
    }}
  />
);

export default DatePickerField;
