import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ViewCounter({ slug }) {
  const [views, setViews] = useState(0);

  useEffect(() => {
    async function updateViews() {
      const { error } = await supabase.rpc('increment_views', { row_slug: slug });
      if (error) console.error(error);
      
      const { data } = await supabase
        .from('post_meta')
        .select('views')
        .eq('slug', slug)
        .single();
        
      if (data) setViews(data.views);
    }
    updateViews();
  }, [slug]);

  return <span>Views: {views}</span>;
}
