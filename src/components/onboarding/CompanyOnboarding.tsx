import { useNavigate } from 'react-router-dom';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

export function CompanyOnboarding() {
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
      title: 'Welcome to Your Company Dashboard!',
      description: 'Manage your company profile, team members, and network connections.',
    },
    {
      id: 'profile',
      title: 'Company Profile',
      description: 'Update your company information to attract potential partners and clients.',
      target: '[data-tour="company-profile"]',
    },
    {
      id: 'team',
      title: 'Manage Team Members',
      description: 'Add and manage your company team members to collaborate effectively.',
      target: '[data-tour="team-members"]',
    },
    {
      id: 'network',
      title: 'Build Your Network',
      description: 'Connect with other companies and professionals in your industry.',
      action: () => navigate('/member/browse-companies'),
    },
    {
      id: 'feed',
      title: 'Share Updates',
      description: 'Post company updates, achievements, and news to engage with your network.',
      action: () => navigate('/company/feed'),
    },
    {
      id: 'events',
      title: 'Create Events',
      description: 'Create events directly from the floating button to add them to the calendar.',
      target: '[data-tour="event-requisition"]',
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
