'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { getUser, registerUser } from '@/lib/api';

const STORAGE_KEY = 'mihna_user';
const LEGACY_STORAGE_KEYS = ['nexus_user'];
const STORAGE_EVENT = 'mihna-user-change';

function safeParseUser(rawValue, expectedRole) {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue);
    if (expectedRole && parsed.role !== expectedRole) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getStoredUserSnapshot() {
  if (typeof window === 'undefined') return '';
  return (
    window.localStorage.getItem(STORAGE_KEY) ||
    LEGACY_STORAGE_KEYS.map(key => window.localStorage.getItem(key)).find(Boolean) ||
    ''
  );
}

export function loadStoredUser(expectedRole) {
  return safeParseUser(getStoredUserSnapshot(), expectedRole);
}

export function saveStoredUser(user) {
  if (typeof window === 'undefined' || !user) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function clearStoredUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach(key => window.localStorage.removeItem(key));
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

function subscribeToStoredUser(callback) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  function handleChange() {
    callback();
  }

  window.addEventListener('storage', handleChange);
  window.addEventListener(STORAGE_EVENT, handleChange);

  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener(STORAGE_EVENT, handleChange);
  };
}

export function useStoredUser(expectedRole) {
  const router = useRouter();
  const storedUserSnapshot = useSyncExternalStore(
    subscribeToStoredUser,
    getStoredUserSnapshot,
    () => '',
  );
  const user = useMemo(() => safeParseUser(storedUserSnapshot, expectedRole), [expectedRole, storedUserSnapshot]);

  useEffect(() => {
    if (!user) {
      if (loadStoredUser(expectedRole)) {
        return;
      }
      clearStoredUser();
      router.replace('/');
      return;
    }

    let active = true;

    async function hydrateUser() {
      try {
        const freshUser = await getUser(user.id);
        if (!active) return;
        saveStoredUser(freshUser);
      } catch {
        try {
          const restoredUser = await registerUser(user.name, user.email, user.role);
          if (!active) return;
          saveStoredUser(restoredUser);
        } catch {
          if (!active) return;
          clearStoredUser();
          router.replace('/');
        }
      }
    }

    hydrateUser();

    return () => {
      active = false;
    };
  }, [expectedRole, router, user]);

  return user;
}

export function signOutUser(router) {
  clearStoredUser();
  router.replace('/');
}
