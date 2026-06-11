import { Box, MenuItem, TextField } from '@mui/material';
import { useMemo } from 'react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const getDaysInMonth = (month, year) => {
  if (!month || !year) {
    return 31;
  }
  return new Date(year, month, 0).getDate();
};

const DateMonthYearPicker = ({
  value = { day: '', month: '', year: '' },
  onChange,
  disabled = false,
  size = 'small',
  yearStart = 1950,
  yearEnd = new Date().getFullYear() + 10,
  dayLabel = 'Day',
  monthLabel = 'Month',
  yearLabel = 'Year',
}) => {
  const years = useMemo(() => {
    const list = [];
    for (let year = yearEnd; year >= yearStart; year -= 1) {
      list.push(year);
    }
    return list;
  }, [yearStart, yearEnd]);

  const days = useMemo(() => {
    const totalDays = getDaysInMonth(Number(value.month), Number(value.year));
    return Array.from({ length: totalDays }, (_, index) => index + 1);
  }, [value.month, value.year]);

  const handleChange = (field) => (event) => {
    const nextValue = {
      ...value,
      [field]: event.target.value,
    };

    if (nextValue.month && nextValue.year && nextValue.day) {
      const maxDay = getDaysInMonth(Number(nextValue.month), Number(nextValue.year));
      if (Number(nextValue.day) > maxDay) {
        nextValue.day = maxDay;
      }
    }

    onChange(nextValue);
  };

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField
        select
        label={dayLabel}
        value={value.day}
        onChange={handleChange('day')}
        size={size}
        disabled={disabled}
        sx={{ minWidth: 100, flex: 1 }}
      >
        <MenuItem value="">Select</MenuItem>
        {days.map((day) => (
          <MenuItem key={day} value={day}>
            {day}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label={monthLabel}
        value={value.month}
        onChange={handleChange('month')}
        size={size}
        disabled={disabled}
        sx={{ minWidth: 140, flex: 1 }}
      >
        <MenuItem value="">Select</MenuItem>
        {MONTHS.map((month) => (
          <MenuItem key={month.value} value={month.value}>
            {month.label}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label={yearLabel}
        value={value.year}
        onChange={handleChange('year')}
        size={size}
        disabled={disabled}
        sx={{ minWidth: 120, flex: 1 }}
      >
        <MenuItem value="">Select</MenuItem>
        {years.map((year) => (
          <MenuItem key={year} value={year}>
            {year}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};

export default DateMonthYearPicker;
