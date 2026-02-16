
import { create } from 'zustand';
import { Session, User as AuthUser } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { User as UserProfile } from '../types';

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  checkUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      set({ user: null, profile: null, session: null });
      localStorage.clear();
    }
  },
  checkUser: async () => {
    // Safety timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
        console.warn("Auth check timed out, forcing load completion");
        set((state) => (state.loading ? { loading: false } : {}));
    }, 5000);

    try {
      // 1. Get Session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
          console.error("Auth Session Error:", sessionError);
          set({ loading: false, user: null, session: null });
          clearTimeout(timeoutId);
          return;
      }

      // 2. If no session, stop loading
      if (!session?.user) {
        set({ user: null, session: null, loading: false });
        clearTimeout(timeoutId);
        return;
      }

      // 3. Get Profile
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError);
      }

      set({ 
        session, 
        user: session.user, 
        profile: profile || null,
        loading: false 
      });
      
      clearTimeout(timeoutId);

      // 4. Listen for changes
      // Note: This adds a new listener every time checkUser is called.
      // Ideally should be outside or managed to avoid duplicates.
      // For now, it's acceptable if checkUser is only called on mount.
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        if (newSession?.user) {
             const { data: newProfile } = await supabase
            .from('users')
            .select('*')
            .eq('id', newSession.user.id)
            .single();
            
            set({ 
                session: newSession, 
                user: newSession.user, 
                profile: newProfile || null,
                loading: false 
            });
        } else {
            set({ session: null, user: null, profile: null, loading: false });
        }
      });

    } catch (error) {
      console.error('Error checking user:', error);
      set({ loading: false });
      clearTimeout(timeoutId);
    }
  },
}));
