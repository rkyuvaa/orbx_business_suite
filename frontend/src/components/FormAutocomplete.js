import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { Autocomplete, TextField, CircularProgress } from '@mui/material';
import apiClient from '../api/client';

const FormAutocomplete = ({
  name,
  control,
  label,
  endpoint,
  onChangeOverride,
  disabled = false,
  required = false,
  defaultValue = '',
  // Standalone mode:
  value,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const hasLoaded = useRef(false);

  const fetchOptions = useCallback(
    async (searchQuery = '') => {
      setLoading(true);
      try {
        const res = await apiClient.get(endpoint, {
          params: { search: searchQuery },
        });
        setOptions(res.data);
        hasLoaded.current = true;
      } catch (err) {
        console.error('Failed to fetch options for', label, err);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, label]
  );

  // Debounced search
  useEffect(() => {
    if (!open) return;
    
    if (!hasLoaded.current || searchTerm === '') {
      fetchOptions(searchTerm);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      fetchOptions(searchTerm);
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [open, searchTerm, fetchOptions]);

  // Reset loaded status on close
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      hasLoaded.current = false;
    }
  }, [open]);

  const renderAutocomplete = (fieldVal, fieldOnChange, fieldError) => {
    const selectedOption = options.find((opt) => opt.id === fieldVal) || null;

    return (
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        disabled={disabled}
        getOptionLabel={(option) => {
          if (option.sku) {
            return `${option.name} (${option.sku})`;
          }
          if (option.code) {
            return `${option.name} (${option.code})`;
          }
          return option.name || '';
        }}
        isOptionEqualToValue={(option, val) => {
          const valId = typeof val === 'object' && val !== null ? val.id : val;
          return option.id === valId;
        }}
        options={options}
        loading={loading}
        value={selectedOption}
        onInputChange={(event, newInputValue, reason) => {
          if (reason === 'input') {
            setSearchTerm(newInputValue);
          }
        }}
        onChange={(event, newValue) => {
          const val = newValue ? newValue.id : '';
          fieldOnChange(val);
          if (onChangeOverride) {
            onChangeOverride(newValue);
          }
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            error={!!fieldError}
            helperText={fieldError ? fieldError.message : null}
            required={required}
            sx={{ mb: 2 }}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress color="inherit" size={20} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    );
  };

  if (control) {
    return (
      <Controller
        name={name}
        control={control}
        defaultValue={defaultValue}
        render={({ field: { onChange: ctrlOnChange, value: ctrlValue }, fieldState: { error } }) =>
          renderAutocomplete(ctrlValue, ctrlOnChange, error)
        }
      />
    );
  }

  return renderAutocomplete(value, onChange, null);
};

export default FormAutocomplete;
