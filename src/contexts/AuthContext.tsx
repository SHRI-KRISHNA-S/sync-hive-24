 import React, { createContext, useContext, useEffect, useState } from 'react';
 import { User, Session } from '@supabase/supabase-js';
 import { supabase } from '@/integrations/supabase/client';
 import { Profile } from '@/lib/supabase-types';
 
 interface AuthContextType {
   user: User | null;
   session: Session | null;
   profile: Profile | null;
   loading: boolean;
   signUp: (email: string, password: string, username: string, fullName?: string) => Promise<{ error: Error | null }>;
   signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
   signOut: () => Promise<void>;
   updateProfile: (updates: Partial<Profile>) => Promise<void>;
 }
 
 const AuthContext = createContext<AuthContextType | undefined>(undefined);
 
 export const useAuth = () => {
   const context = useContext(AuthContext);
   if (!context) {
     throw new Error('useAuth must be used within an AuthProvider');
   }
   return context;
 };
 
 export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
   const [user, setUser] = useState<User | null>(null);
   const [session, setSession] = useState<Session | null>(null);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [loading, setLoading] = useState(true);
 
   const fetchProfile = async (userId: string) => {
     const { data, error } = await supabase
       .from('profiles')
       .select('*')
       .eq('user_id', userId)
       .single();
     
     if (!error && data) {
       setProfile(data as Profile);
     }
   };
 
   useEffect(() => {
     // Set up auth state listener FIRST
     const { data: { subscription } } = supabase.auth.onAuthStateChange(
       (event, session) => {
         setSession(session);
         setUser(session?.user ?? null);
         
         if (session?.user) {
           // Defer profile fetch to avoid deadlock
           setTimeout(() => {
             fetchProfile(session.user.id);
           }, 0);
         } else {
           setProfile(null);
         }
       }
     );
 
     // THEN check for existing session
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
       setUser(session?.user ?? null);
       if (session?.user) {
         fetchProfile(session.user.id);
       }
       setLoading(false);
     });
 
     return () => subscription.unsubscribe();
   }, []);
 
     const signUp = async (email: string, password: string, username: string, fullName?: string) => {
       if (!email.endsWith('@bitsathy.ac.in')) {
         return { error: new Error('Only @bitsathy.ac.in email addresses are allowed') };
       }

       const redirectUrl = `${window.location.origin}/`;
       
       const { error } = await supabase.auth.signUp({
         email,
         password,
         options: {
           emailRedirectTo: redirectUrl,
           data: {
             username,
             display_name: fullName?.trim() || username,
           },
         },
       });
       
       return { error: error as Error | null };
     };
 
    const signIn = async (email: string, password: string) => {
      if (!email.endsWith('@bitsathy.ac.in')) {
        return { error: new Error('Only @bitsathy.ac.in email addresses are allowed') };
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      return { error: error as Error | null };
    };
 
   const signOut = async () => {
     await supabase.auth.signOut();
     setProfile(null);
   };
 
   const updateProfile = async (updates: Partial<Profile>) => {
     if (!user) return;
     
     const { error } = await supabase
       .from('profiles')
       .update(updates)
       .eq('user_id', user.id);
     
     if (!error) {
       await fetchProfile(user.id);
     }
   };
 
   return (
     <AuthContext.Provider value={{
       user,
       session,
       profile,
       loading,
       signUp,
       signIn,
       signOut,
       updateProfile,
     }}>
       {children}
     </AuthContext.Provider>
   );
 };