import { useEffect, useState, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { supabase } from '../lib/supabase';

export default function KnowledgeGraph({ slug }) {
    const [graphData, setGraphData] = useState({ nodes: [], links: [] });

    useEffect(() => {
        async function loadGraph() {
            const { data: currentPost } = await supabase.from('post_embeddings').select('embedding, title').eq('slug', slug).single();
            
            if (!currentPost) return;

            const { data: related } = await supabase.rpc('match_posts', {
                query_embedding: currentPost.embedding,
                match_threshold: 0.5,
                match_count: 5,
                current_slug: slug
            });

            if (related) {
                const nodes = [
                    { id: slug, name: currentPost.title || slug, val: 2 },
                    ...related.map(p => ({ id: p.slug, name: p.title, val: 1 }))
                ];
                const links = related.map(p => ({ source: slug, target: p.slug }));
                
                setGraphData({ nodes, links });
            }
        }
        loadGraph();
    }, [slug]);

    if (graphData.nodes.length === 0) return null;

    return (
        <div style={{ height: 400, border: '1px solid #ccc' }}>
             <ForceGraph2D
                graphData={graphData}
                nodeLabel="name"
                nodeAutoColorBy="group"
                linkDirectionalParticles={2}
                width={600}
                height={400}
            />
        </div>
    );
}
