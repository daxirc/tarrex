import { create } from 'zustand';
import { supabase } from './supabase';

interface UserState {
  user: any | null;
  wallet: {
    balance: number;
  } | null;
  isLoading: boolean;
  error: string | null;
  fetchUser: () => Promise<void>;
  fetchWallet: () => Promise<void>;
}

const clearSupabaseData = () => {
  // Clear all Supabase-related items from localStorage
  Object.keys(localStorage)
    .filter(key => key.startsWith('sb-'))
    .forEach(key => localStorage.removeItem(key));
};

export const useStore = create<UserState>((set) => ({
  user: null,
  wallet: null,
  isLoading: true,
  error: null,

  fetchUser: async () => {
    try {
      set({ isLoading: true, error: null });

      // Get session first to ensure auth state is properly initialized
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Handle session error by signing out and clearing state
      if (sessionError) {
        // Check if error is related to refresh token
        if (sessionError.message?.includes('refresh_token_not_found') || 
            sessionError.message?.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut();
          clearSupabaseData();
          window.location.href = '/login'; // Hard redirect to login
          return;
        }
        
        await supabase.auth.signOut();
        set({ user: null, wallet: null, isLoading: false });
        return;
      }

      // If no session, clear user state
      if (!session) {
        set({ user: null, wallet: null, isLoading: false });
        return;
      }

      // Get user data from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        await supabase.auth.signOut();
        set({ user: null, wallet: null, error: 'Failed to fetch user data' });
        return;
      }

      set({ user: userData });
    } catch (error) {
      console.error('Error fetching user:', error);
      // Check if error is related to refresh token
      if (error instanceof Error && 
          (error.message?.includes('refresh_token_not_found') || 
           error.message?.includes('Invalid Refresh Token'))) {
        await supabase.auth.signOut();
        clearSupabaseData();
        window.location.href = '/login'; // Hard redirect to login
        return;
      }
      await supabase.auth.signOut();
      set({ user: null, wallet: null, error: 'Failed to fetch user data' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchWallet: async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        // Check if error is related to refresh token
        if (sessionError.message?.includes('refresh_token_not_found') || 
            sessionError.message?.includes('Invalid Refresh Token')) {
          await supabase.auth.signOut();
          clearSupabaseData();
          window.location.href = '/login'; // Hard redirect to login
          return;
        }
        set({ wallet: null });
        return;
      }

      if (!session?.user) {
        set({ wallet: null });
        return;
      }

      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        set({ wallet: null, error: 'Failed to fetch wallet data' });
        return;
      }

      set({ wallet });
    } catch (error) {
      console.error('Error fetching wallet:', error);
      // Check if error is related to refresh token
      if (error instanceof Error && 
          (error.message?.includes('refresh_token_not_found') || 
           error.message?.includes('Invalid Refresh Token'))) {
        await supabase.auth.signOut();
        clearSupabaseData();
        window.location.href = '/login'; // Hard redirect to login
        return;
      }
      set({ wallet: null, error: 'Failed to fetch wallet data' });
    }
  }
}));