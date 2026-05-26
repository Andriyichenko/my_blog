import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminGuard({ children }) {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        async function checkUser() {
            const { data: { user } } = await supabase.auth.getUser();
            // Simplified admin check: check if user exists or specific metadata
            // Real app would check roles
            if (user) {
                setIsAdmin(true); 
            }
            setLoading(false);
        }
        checkUser();
    }, []);
    
    if (loading) return <div>Loading...</div>;
    if (!isAdmin) return <div>Access Denied</div>;

    return children;
}
