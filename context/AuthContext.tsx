import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged,
  updateProfile,
  User
} from 'firebase/auth';
import { Alert } from 'react-native';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      let errorMessage = 'An error occurred';
      switch (error.code) {
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
          errorMessage = 'Invalid Credentials';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This user has been banned';
          break;
        case 'auth/user-not-found':
          errorMessage = "User with this email doesn't exist.";
          break;
        default:
          errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
      throw error;
    }
  };

  const signUp = async (email: string, pass: string, name: string) => {
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(res.user, { displayName: name });
      // Force refresh user to get display name immediately
      setUser({ ...res.user });
    } catch (error: any) {
      let errorMessage = 'Something went wrong! Try again.';
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'User with this email already exists.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Email is invalid.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Choose a strong password.';
          break;
        default:
          errorMessage = error.message;
      }
      Alert.alert('Error', errorMessage);
      throw error;
    }
  };

  const forgotPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email sent. Check your inbox.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred.');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, signIn, signUp, signOut, forgotPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};
