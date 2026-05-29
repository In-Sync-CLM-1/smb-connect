import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackPath?: string;
  label?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

/**
 * Back button that navigates to the previous page in browser history,
 * or falls back to the specified path if no history exists
 */
export const BackButton = ({ 
  fallbackPath = '/dashboard', 
  label = 'Back',
  variant = 'ghost',
  size = 'default',
  className
}: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Try to go back; if it fails or there's no real history, use fallback
    try {
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate(fallbackPath);
      }
    } catch {
      navigate(fallbackPath);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleBack} className={className}>
      <ArrowLeft className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};
