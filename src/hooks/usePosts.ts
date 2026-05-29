import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Custom hook to manage posts (feed functionality)
 * Consolidates post CRUD operations and loading logic
 */
export function usePosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    loadPosts();

    // Set up realtime subscription
    const channel = supabase
      .channel('posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPosts(prev => [payload.new as Post, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setPosts(prev => prev.map(post => 
              post.id === (payload.new as Post).id ? { ...post, ...payload.new } : post
            ));
          } else if (payload.eventType === 'DELETE') {
            setPosts(prev => prev.filter(post => post.id !== (payload.old as Post).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false});

      if (fetchError) throw fetchError;

      setPosts(data || []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  const createPost = async (content: string, imageUrl?: string | null) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content.trim(),
        image_url: imageUrl || null,
      });

      if (insertError) throw insertError;

      await loadPosts();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const updatePost = async (postId: string, content: string) => {
    try {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ content: content.trim(), updated_at: new Date().toISOString() })
        .eq('id', postId);

      if (updateError) throw updateError;

      await loadPosts();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const deletePost = async (postId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;

      await loadPosts();
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const likePost = async (postId: string, userId: string) => {
    try {
      const { error: likeError } = await supabase.from('post_likes').insert({
        post_id: postId,
        user_id: userId,
      });

      if (likeError) throw likeError;

      // Realtime subscription handles count updates
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const unlikePost = async (postId: string, userId: string) => {
    try {
      const { error: unlikeError } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (unlikeError) throw unlikeError;

      // Realtime subscription handles count updates
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return {
    posts,
    loading,
    error,
    refresh: loadPosts,
    createPost,
    updatePost,
    deletePost,
    likePost,
    unlikePost,
  };
}
