import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase, supabaseConfigError } from "../supabaseClient";

const AuthContext = createContext(null);

function isUserEmailVerified(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setAuthError(
        supabaseConfigError ||
          "Supabase is not configured. Authentication is currently unavailable.",
      );
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    const initializeAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        console.error("Auth initialization error:", error);
        setAuthError("Could not initialize authentication.");
      }

      const initialSession = data?.session || null;
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setAuthLoading(false);
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!supabase) {
      return {
        success: false,
        error: supabaseConfigError || "Supabase is not configured.",
      };
    }

    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Error refreshing auth user:", error);
      return {
        success: false,
        error: error.message || "Could not refresh user.",
      };
    }

    setUser(data?.user || null);
    setSession((currentSession) => {
      if (!currentSession) return currentSession;
      return {
        ...currentSession,
        user: data?.user || null,
      };
    });

    return { success: true, user: data?.user || null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      return {
        success: false,
        error: supabaseConfigError || "Supabase is not configured.",
      };
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error);
      return {
        success: false,
        error: error.message || "Could not sign out.",
      };
    }

    return { success: true };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      isVerified: isUserEmailVerified(user),
      authLoading,
      authError,
      refreshUser,
      signOut,
    }),
    [session, user, authLoading, authError, refreshUser, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
