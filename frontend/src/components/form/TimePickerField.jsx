import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';

const TimePickerField = ({
  label = 'Time',
  value,
  onChange,
  fullWidth = true,
  size = 'small',
  disabled = false,
  format = 'hh:mm A',
}) => (
  <TimePicker
    label={label}
    value={value ? dayjs(value) : null}
    onChange={(newValue) => onChange(newValue ? newValue.toDate() : null)}
    format={format}
    disabled={disabled}
    slotProps={{
      textField: {
        fullWidth,
        size,
      },
    }}
  />
);

export default TimePickerField;
