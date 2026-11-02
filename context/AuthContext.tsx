import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, database } from '../firebaseConfig';
import { onValue, ref } from 'firebase/database';
import { claimUsername, syncIdentity } from '../services/identity';
import { UserProfile } from '../types';
import { unregisterPush } from '../services/push';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  reload,
  User
} from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  profile: UserProfile | null;
  identityError: string | null;
  setUsername: (username: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setProfile(null);
      setIdentityError(null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const uid = user?.uid;
  useEffect(() => {
    if (!uid || !auth.currentUser) return;
    let active = true;
    void syncIdentity(auth.currentUser).catch(() => {
      if (active) setIdentityError('Could not sync your sharing profile. Check your connection and retry.');
    });
    const unsubscribe = onValue(ref(database, `profiles/${uid}`), snapshot => {
      if (active) setProfile(snapshot.val());
    }, () => {
      if (active) setIdentityError('Could not load your sharing profile. Check your connection and retry.');
    });
    return () => { active = false; unsubscribe(); };
  }, [uid]);

  const refreshIdentity = async () => {
    const current = auth.currentUser;
    if (!current) throw new Error('Sign in to continue.');
    await reload(current);
    await current.getIdToken(true);
    await syncIdentity(current);
    setUser({ ...current });
    setIdentityError(null);
  };

  const setUsername = async (username: string) => {
    if (!auth.currentUser) throw new Error('Sign in to continue.');
    await claimUsername(auth.currentUser, username);
    setIdentityError(null);
  };

  const sendVerification = async () => {
    if (!auth.currentUser) throw new Error('Sign in to continue.');
    await sendEmailVerification(auth.currentUser);
  };

  const signIn = async (email: string, pass: string) => {
    if (auth.currentUser) await unregisterPush(auth.currentUser);
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUp = async (email: string, pass: string, name: string) => {
    if (auth.currentUser) await unregisterPush(auth.currentUser);
    const res = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    await updateProfile(res.user, { displayName: name.trim() });
    await syncIdentity(res.user).catch(() => {
      setIdentityError('Open Sharing to retry syncing your profile.');
    });
    setUser({ ...res.user });
  };

  const forgotPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const signOut = async () => {
    if (auth.currentUser) await unregisterPush(auth.currentUser);
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signIn, signUp, signOut, forgotPassword, profile, identityError, setUsername, sendVerification, refreshIdentity }}
    >
      {children}
    </AuthContext.Provider>
  );
};
