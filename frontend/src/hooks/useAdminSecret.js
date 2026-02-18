import { useState } from 'react';

const STORAGE_KEY = 'movienightapp_admin_secret';

export function useAdminSecret() {
  const [secret, setSecretState] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  });

  const setSecret = (s) => {
    sessionStorage.setItem(STORAGE_KEY, s);
    setSecretState(s);
  };

  const clearSecret = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setSecretState('');
  };

  return { secret, setSecret, clearSecret };
}
