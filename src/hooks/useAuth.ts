import { useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuthStore } from '../store/authStore';
import { getUser, getRole } from '../lib/firestore';

export function useAuthInit() {
  const { setFirebaseUser, setAppUser, setRole, setLoading, setInitialized } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        try {
          const appUser = await getUser(firebaseUser.uid);
          setAppUser(appUser);

          if (appUser?.roleId) {
            const role = await getRole(appUser.roleId);
            setRole(role);
          } else {
            setRole(null);
          }
        } catch (err) {
          console.error('Error loading user data:', err);
          setAppUser(null);
          setRole(null);
        }
      } else {
        setAppUser(null);
        setRole(null);
      }

      setLoading(false);
      setInitialized(true);
    });

    return unsub;
  }, [setFirebaseUser, setAppUser, setRole, setLoading, setInitialized]);
}

export async function logout() {
  await signOut(auth);
}
