import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useAuth } from './useAuth';
import type { BrandConfig } from '../types';

export function useBrandConfig() {
  const { user } = useAuth();
  const [config, setConfig] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadConfig();
  }, [user]);

  const loadConfig = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('brand_configs')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setConfig(data);
    setLoading(false);
  };

  const saveConfig = async (updates: Partial<BrandConfig>) => {
    if (!user) return { data: null, error: new Error('Not authenticated') };

    if (config) {
      const { data, error } = await supabase
        .from('brand_configs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', config.id)
        .select()
        .single();
      if (!error && data) setConfig(data);
      return { data, error };
    } else {
      const { data, error } = await supabase
        .from('brand_configs')
        .insert({ ...updates, user_id: user.id })
        .select()
        .single();
      if (!error && data) setConfig(data);
      return { data, error };
    }
  };

  return { config, loading, saveConfig, reload: loadConfig };
}
