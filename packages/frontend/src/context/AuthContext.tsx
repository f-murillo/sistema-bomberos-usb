import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import type { Usuario } from '@bomberos-usb/shared';

interface AuthContextType {
  user: User | null;
  userData: Usuario | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isBombero: boolean;
  isCuentaAdministrativa: boolean;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  userData: null, 
  loading: true,
  isAdmin: false,
  isSupervisor: false,
  isBombero: false,
  isCuentaAdministrativa: false
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Esto escucha cambios en la sesión (login/logout) automáticamente
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Buscamos el documento del usuario en Firestore por su UID
        const userDoc = await getDoc(doc(db, 'usuarios', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data() as Usuario);
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    isAdmin: userData?.rol === 'ADMIN',
    isSupervisor: userData?.rol === 'SUPERVISOR',
    isBombero: userData?.rol === 'BOMBERO',
    isCuentaAdministrativa: userData?.rol === 'CUENTA_ADMINISTRATIVA'
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);