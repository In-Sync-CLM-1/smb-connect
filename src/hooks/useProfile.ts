import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  headline: string | null;
  bio: string | null;
  avatar: string | null;
  cover_image: string | null;
  location: string | null;
  phone: string | null;
  linkedin_url: string | null;
  twitter_url: string | null;
  website_url: string | null;
  employment_status: string | null;
  open_to_work: boolean;
}

/**
 * Custom hook to fetch and manage user profile data
 * Consolidates profile loading logic used across multiple components
 */
export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const latestUserIdRef = useRef<string | null | undefined>(userId);
  const requestIdRef = useRef(0);

  useEffect(() => {
    latestUserIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }

    loadProfile(userId);
  }, [userId]);

  const loadProfile = async (targetUserId = latestUserIdRef.current) => {
    if (!targetUserId) return;

    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (requestId !== requestIdRef.current || targetUserId !== latestUserIdRef.current) {
        return;
      }

      setProfile(data);
    } catch (err) {
      if (requestId !== requestIdRef.current || targetUserId !== latestUserIdRef.current) {
        return;
      }

      setError(err as Error);
      setProfile(null);
    } finally {
      if (requestId === requestIdRef.current && targetUserId === latestUserIdRef.current) {
        setLoading(false);
      }
    }
  };

  const updateProfile = async (updates: Partial<ProfileData>) => {
    if (!userId) return { error: new Error('No user ID') };

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (updateError) throw updateError;

      await loadProfile(userId);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return { profile, loading, error, refresh: loadProfile, updateProfile };
}
