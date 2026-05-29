import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  pullProgress: number;
  isRefreshing: boolean;
  threshold?: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  pullProgress,
  isRefreshing,
  threshold = 80,
}: PullToRefreshIndicatorProps) {
  if (pullDistance === 0 && !isRefreshing) return null;

  return (
    <div 
      className="flex justify-center items-center overflow-hidden transition-all duration-200 ease-out"
      style={{ 
        height: isRefreshing ? 50 : pullDistance,
        opacity: Math.min(pullProgress, 1)
      }}
    >
      <div 
        className={cn(
          "flex items-center justify-center w-8 h-8 rounded-full bg-primary/10",
          isRefreshing && "animate-spin"
        )}
        style={{
          transform: isRefreshing ? 'none' : `rotate(${pullProgress * 360}deg)`,
        }}
      >
        <RefreshCw className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}
