import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';

const DateTimePickerField = ({
  label = 'Date & Time',
  value,
  onChange,
  fullWidth = true,
  size = 'small',
  disabled = false,
  format = 'DD-MM-YYYY hh:mm A',
  minDateTime,
  maxDateTime,
}) => (
  <DateTimePicker
    label={label}
    value={value ? dayjs(value) : null}
    onChange={(newValue) => onChange(newValue ? newValue.toDate() : null)}
    format={format}
    disabled={disabled}
    minDateTime={minDateTime ? dayjs(minDateTime) : undefined}
    maxDateTime={maxDateTime ? dayjs(maxDateTime) : undefined}
    slotProps={{
      textField: {
        fullWidth,
        size,
      },
    }}
  />
);

export default DateTimePickerField;
