import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Recommendation() {
    const [posts, setPosts] = useState([]);
    
    useEffect(() => {
        async function fetchRecs() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data, error } = await supabase.rpc('get_personalized_recommendations', {
                p_user_id: user.id
            });
            if (data) setPosts(data);
        }
        fetchRecs();
    }, []);

    if (posts.length === 0) return null;
    
    return (
        <div className="recommendation-list">
            <h3>Recommended for You</h3>
            <ul>
                {posts.map(p => (
                    <li key={p.slug}>
                        <a href={`/blog/${p.slug}`}>{p.title}</a> 
                        <span className="text-sm text-gray-500 ml-2">({Math.round(p.similarity * 100)}% match)</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
