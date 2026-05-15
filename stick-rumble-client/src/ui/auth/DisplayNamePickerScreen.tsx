import { useState } from 'react';
import { getApiBaseUrl } from '../../game/config/runtimeConfig';
import './AuthStyles.css';

interface DisplayNamePickerScreenProps {
  token: string;
  onConfirm: (displayName: string) => void;
}

export function DisplayNamePickerScreen({ token, onConfirm }: DisplayNamePickerScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = (value: string): string | null => {
    if (!value.trim()) return 'Name is required';
    if (value.trim().length > 16) return 'Max 16 characters';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${getApiBaseUrl()}/player/displayname`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: name.trim() }),
      });

      if (!response.ok) {
        setError('Failed to save name');
        setLoading(false);
        return;
      }

      const data = await response.json();
      setLoading(false);
      onConfirm(data.displayName);
    } catch {
      setError('Network error');
      setLoading(false);
    }
  };

  return (
    <div className="display-name-picker-screen">
      <h1>Choose Your Name</h1>
      <p>Pick a display name (max 16 characters)</p>
      <input
        type="text"
        placeholder="Enter your name..."
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError('');
        }}
        maxLength={16}
        disabled={loading}
      />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Saving...' : 'Confirm'}
      </button>
    </div>
  );
}
