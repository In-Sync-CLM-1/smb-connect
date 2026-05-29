import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Star, Sparkles } from 'lucide-react';

interface PostEngagementBadgeProps {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  repostsCount: number;
}

type EngagementLevel = 'viral' | 'popular' | 'trending' | 'hot' | null;

export function getEngagementLevel(
  likesCount: number,
  commentsCount: number,
  sharesCount: number,
  repostsCount: number
): EngagementLevel {
  const totalEngagement = likesCount + commentsCount * 2 + sharesCount * 3 + repostsCount * 2;
  
  if (totalEngagement >= 100 || sharesCount >= 20) {
    return 'viral';
  }
  if (totalEngagement >= 50 || likesCount >= 25) {
    return 'popular';
  }
  if (totalEngagement >= 25 || commentsCount >= 10) {
    return 'trending';
  }
  if (totalEngagement >= 10) {
    return 'hot';
  }
  return null;
}

export function PostEngagementBadge({ 
  likesCount, 
  commentsCount, 
  sharesCount,
  repostsCount 
}: PostEngagementBadgeProps) {
  const level = getEngagementLevel(likesCount, commentsCount, sharesCount, repostsCount);
  
  if (!level) return null;
  
  const badgeConfig = {
    viral: {
      label: 'Viral',
      icon: Sparkles,
      className: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 animate-pulse',
    },
    popular: {
      label: 'Popular',
      icon: Star,
      className: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0',
    },
    trending: {
      label: 'Trending',
      icon: TrendingUp,
      className: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0',
    },
    hot: {
      label: 'Hot',
      icon: Flame,
      className: 'bg-gradient-to-r from-red-500 to-orange-500 text-white border-0',
    },
  };
  
  const config = badgeConfig[level];
  const Icon = config.icon;
  
  return (
    <Badge className={`${config.className} text-xs font-medium gap-1`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}