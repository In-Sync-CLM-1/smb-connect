import { useNavigate } from 'react-router-dom';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

export function MemberOnboarding() {
  const navigate = useNavigate();
  const {
    showOnboarding,
    currentStep,
    nextStep,
    previousStep,
    skipOnboarding,
  } = useOnboarding();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to SMB Connect!',
      description: 'Let\'s take a quick tour to help you get started with connecting and growing your network.',
    },
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Add your professional details, work experience, and skills to make meaningful connections.',
      action: () => navigate('/member'),
    },
    {
      id: 'browse',
      title: 'Discover Members',
      description: 'Browse and connect with other professionals in your industry and association.',
      target: '[data-tour="browse-members"]',
    },
    {
      id: 'feed',
      title: 'Stay Updated',
      description: 'Share updates, engage with posts, and stay connected with your network through the feed.',
      target: '[data-tour="feed"]',
    },
    {
      id: 'messages',
      title: 'Start Conversations',
      description: 'Send messages to your connections and build meaningful professional relationships.',
      target: '[data-tour="messages"]',
    },
    {
      id: 'calendar',
      title: 'Track Events',
      description: 'View upcoming events, meetings, and important dates on the calendar.',
      target: '[data-tour="calendar"]',
    },
  ];

  if (!showOnboarding) return null;

  return (
    <OnboardingTour
      steps={steps}
      currentStep={currentStep}
      onNext={() => nextStep(steps)}
      onPrevious={previousStep}
      onSkip={skipOnboarding}
    />
  );
}
