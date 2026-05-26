import { useUserTracker } from '../hooks/useUserTracker';

export default function ArticleTracker({ slug }) {
    useUserTracker(slug);
    return null;
}
