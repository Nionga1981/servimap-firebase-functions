"use client";

import { createContext, useContext, useState, useEffect } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  birthDate?: string;
  userType: 'client' | 'provider' | 'business';
  isEmailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
  profile?: {
    firstName?: string;
    lastName?: string;
    location?: {
      lat: number;
      lng: number;
      address: string;
    };
    preferences?: any;
  };
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: {
    displayName: string;
    phoneNumber?: string;
    birthDate?: string;
    userType?: 'client' | 'provider' | 'business';
  }) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  signUp: async () => { throw new Error('AuthContext not initialized'); },
  signIn: async () => { throw new Error('AuthContext not initialized'); },
  logout: async () => { throw new Error('AuthContext not initialized'); },
  resetPassword: async () => { throw new Error('AuthContext not initialized'); },
  updateUserProfile: async () => { throw new Error('AuthContext not initialized'); },
  resendVerificationEmail: async () => { throw new Error('AuthContext not initialized'); },
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile from Firestore
  const loadUserProfile = async (user: User) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        const profile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || data.displayName || '',
          photoURL: user.photoURL || data.photoURL,
          phoneNumber: user.phoneNumber || data.phoneNumber,
          birthDate: data.birthDate,
          userType: data.userType || 'client',
          isEmailVerified: user.emailVerified,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLoginAt: new Date(),
          profile: data.profile || {}
        };
        
        // Update last login time
        await updateDoc(userDocRef, {
          lastLoginAt: new Date(),
          isEmailVerified: user.emailVerified
        });
        
        setUserProfile(profile);
      } else {
        // Create user document if it doesn't exist
        const newProfile: UserProfile = {
          uid: user.uid,
          email: user.email!,
          displayName: user.displayName || '',
          photoURL: user.photoURL || undefined,
          phoneNumber: user.phoneNumber || undefined,
          userType: 'client',
          isEmailVerified: user.emailVerified,
          createdAt: new Date(),
          lastLoginAt: new Date(),
        };
        
        await setDoc(userDocRef, {
          ...newProfile,
          createdAt: new Date(),
          lastLoginAt: new Date()
        });
        
        setUserProfile(newProfile);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  // Listen to authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        await loadUserProfile(user);
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign up new user
  const signUp = async (
    email: string, 
    password: string, 
    userData: {
      displayName: string;
      phoneNumber?: string;
      birthDate?: string;
      userType?: 'client' | 'provider' | 'business';
    }
  ): Promise<User> => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update user profile
      await updateProfile(user, {
        displayName: userData.displayName
      });
      
      // Create user document in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: userData.displayName,
        phoneNumber: userData.phoneNumber || null,
        birthDate: userData.birthDate || null,
        userType: userData.userType || 'client',
        isEmailVerified: user.emailVerified,
        createdAt: new Date(),
        lastLoginAt: new Date(),
        profile: {
          firstName: userData.displayName.split(' ')[0] || '',
          lastName: userData.displayName.split(' ').slice(1).join(' ') || '',
        }
      });
      
      // Send email verification
      await sendEmailVerification(user);
      
      return user;
    } catch (error: any) {
      console.error('Error signing up:', error);
      throw new Error(error.message || 'Failed to create account');
    }
  };

  // Sign in user
  const signIn = async (email: string, password: string): Promise<User> => {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (error: any) {
      console.error('Error signing in:', error);
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  // Sign out user
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Error signing out:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  };

  // Reset password
  const resetPassword = async (email: string): Promise<void> => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
  };

  // Update user profile
  const updateUserProfile = async (data: Partial<UserProfile>): Promise<void> => {
    if (!user) throw new Error('No user logged in');
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, data);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, ...data });
      }
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      throw new Error(error.message || 'Failed to update profile');
    }
  };

  // Resend email verification
  const resendVerificationEmail = async (): Promise<void> => {
    if (!user) throw new Error('No user logged in');
    
    try {
      await sendEmailVerification(user);
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      throw new Error(error.message || 'Failed to send verification email');
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    logout,
    resetPassword,
    updateUserProfile,
    resendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}