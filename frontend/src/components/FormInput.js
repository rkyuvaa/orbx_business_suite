import React from 'react';
import { Controller } from 'react-hook-form';
import { TextField, MenuItem } from '@mui/material';

const FormInput = ({
  name,
  control,
  label,
  type = 'text',
  defaultValue = '',
  options = [], // For select fields
  rules = {},
  fullWidth = true,
  disabled = false,
  rows = 1,
  size = 'medium',
  ...rest
}) => {
  return (
    <Controller
      name={name}
      control={control}
      defaultValue={defaultValue}
      rules={rules}
      render={({ field: { onChange, value }, fieldState: { error } }) => (
        <TextField
          {...rest}
          label={label}
          type={type === 'textarea' ? 'text' : type}
          multiline={type === 'textarea'}
          rows={rows}
          select={type === 'select'}
          value={value}
          onChange={(e) => {
            let val = e.target.value;
            if (name.toLowerCase() === 'gstin') {
              val = val.toUpperCase();
            } else if (type === 'email' || name.toLowerCase() === 'email') {
              val = val.toLowerCase();
            }
            onChange(val);
          }}
          inputProps={{
            style: {
              textTransform: name.toLowerCase() === 'gstin' ? 'uppercase' : 'none'
            }
          }}
          disabled={disabled}
          fullWidth={fullWidth}
          size={size}
          error={!!error}
          helperText={error ? error.message : null}
          sx={{ mb: 2 }}
        >
          {type === 'select' &&
            options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
        </TextField>
      )}
    />
  );
};

export default FormInput;
