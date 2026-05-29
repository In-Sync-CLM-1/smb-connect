import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { 
  Share2, 
  Copy, 
  MessageCircle, 
  Linkedin, 
  Twitter, 
  Facebook, 
  Send, 
  Mail 
} from 'lucide-react';

interface SharePostDropdownProps {
  postId: string;
  postContent: string;
  sharesCount?: number;
  onShareComplete?: () => void;
}

export function SharePostDropdown({ 
  postId, 
  postContent, 
  sharesCount = 0,
  onShareComplete 
}: SharePostDropdownProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const getShareUrl = () => {
    return `${window.location.origin}/feed?post=${postId}`;
  };

  const getShareText = () => {
    // Truncate content for share text
    const maxLength = 100;
    const truncated = postContent.length > maxLength 
      ? postContent.substring(0, maxLength) + '...' 
      : postContent;
    return truncated;
  };

  const logShare = async (platform: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      
      await supabase.from('post_shares').insert({
        post_id: postId,
        user_id: user?.id || null,
        platform,
      });

      onShareComplete?.();
    } catch (error) {
      console.error('Error logging share:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      await logShare('copy_link');
      toast({
        title: 'Link copied',
        description: 'Post link copied to clipboard',
      });
      setIsOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async (platform: string) => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    
    let shareUrl = '';
    
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
        break;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'telegram':
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
        break;
      case 'email':
        const subject = encodeURIComponent('Check out this post');
        const body = encodeURIComponent(`${getShareText()}\n\nView post: ${getShareUrl()}`);
        shareUrl = `mailto:?subject=${subject}&body=${body}`;
        break;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
      await logShare(platform);
      toast({
        title: 'Opening share dialog',
        description: `Opening ${platform.charAt(0).toUpperCase() + platform.slice(1)}...`,
      });
    }
    
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2 sm:px-3">
          <Share2 className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">{sharesCount > 0 ? sharesCount : 'Share'}</span>
          <span className="sm:hidden text-xs ml-1">{sharesCount > 0 && sharesCount}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink}>
          <Copy className="w-4 h-4 mr-2" />
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleShare('whatsapp')}>
          <MessageCircle className="w-4 h-4 mr-2" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('linkedin')}>
          <Linkedin className="w-4 h-4 mr-2" />
          LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('twitter')}>
          <Twitter className="w-4 h-4 mr-2" />
          X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('facebook')}>
          <Facebook className="w-4 h-4 mr-2" />
          Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('telegram')}>
          <Send className="w-4 h-4 mr-2" />
          Telegram
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleShare('email')}>
          <Mail className="w-4 h-4 mr-2" />
          Email
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}