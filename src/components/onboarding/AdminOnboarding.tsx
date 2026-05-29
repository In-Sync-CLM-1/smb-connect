import { useNavigate } from 'react-router-dom';
import { OnboardingTour } from '@/components/OnboardingTour';
import { useOnboarding, OnboardingStep } from '@/hooks/useOnboarding';

export function AdminOnboarding() {
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
      title: 'Welcome, Admin!',
      description: 'Let\'s explore the admin dashboard and key management features.',
    },
    {
      id: 'analytics',
      title: 'Monitor Analytics',
      description: 'Track platform usage, user activity, and engagement metrics in real-time.',
      target: '[data-tour="analytics"]',
    },
    {
      id: 'users',
      title: 'Manage Users',
      description: 'View, create, and manage user accounts across the platform.',
      action: () => navigate('/admin/users'),
    },
    {
      id: 'associations',
      title: 'Association Management',
      description: 'Review and approve association requests, and manage existing associations.',
      action: () => navigate('/admin/associations'),
    },
    {
      id: 'companies',
      title: 'Company Management',
      description: 'Oversee company registrations and manage company profiles.',
      action: () => navigate('/admin/companies'),
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
