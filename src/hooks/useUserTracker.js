import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useUserTracker(slug) {
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Record history
        await supabase.from('user_history').insert({ user_id: user.id, slug });
        
        // Trigger Edge Function
        await supabase.functions.invoke('update-interest', {
          body: { article_slug: slug, user_id: user.id }
        });
      }
    }, 30000); // 30s

    return () => clearTimeout(timer);
  }, [slug]);
}
