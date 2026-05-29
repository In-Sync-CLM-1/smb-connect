import { useNavigate } from 'react-router-dom';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

export function AssociationOnboarding() {
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
      title: 'Welcome to Association Dashboard!',
      description: 'Manage your association, members, and companies all in one place.',
    },
    {
      id: 'profile',
      title: 'Association Profile',
      description: 'Keep your association information up-to-date with contact details and key functionaries.',
      action: () => navigate('/association/profile'),
    },
    {
      id: 'companies',
      title: 'Manage Companies',
      description: 'View and manage companies within your association network.',
      action: () => navigate('/association/companies'),
    },
    {
      id: 'invitations',
      title: 'Send Invitations',
      description: 'Invite new companies to join your association and grow your network.',
      target: '[data-tour="send-invitations"]',
    },
    {
      id: 'feed',
      title: 'Engage with Members',
      description: 'Share updates and announcements with your association members through the feed.',
      action: () => navigate('/association/feed'),
    },
    {
      id: 'calendar',
      title: 'Event Calendar',
      description: 'View and manage association events to keep members informed.',
      action: () => navigate('/calendar'),
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
