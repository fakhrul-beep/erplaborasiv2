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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let profile: UserProfile | null = null;
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        profile = data;
      }

      set({ 
        session, 
        user: session?.user ?? null, 
        profile,
        loading: false 
      });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        let newProfile: UserProfile | null = null;
        if (session?.user) {
          const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          newProfile = data;
        }
        set({ 
          session, 
          user: session?.user ?? null, 
          profile: newProfile,
          loading: false 
        });
      });
    } catch (error) {
      console.error('Error checking user:', error);
      set({ loading: false });
    }
  },
}));
