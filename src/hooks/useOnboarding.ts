import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  target?: string;
  action?: () => void;
};

const CURRENT_VERSION = 'v1';

export function useOnboarding() {
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadOnboardingStatus();
  }, []);

  const loadOnboardingStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('user_onboarding')
        .select('*')
        .eq('user_id', user.id)
        .eq('onboarding_version', CURRENT_VERSION)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // First time user - create onboarding record
        const { error: insertError } = await supabase
          .from('user_onboarding')
          .insert({
            user_id: user.id,
            onboarding_version: CURRENT_VERSION,
            completed_steps: [],
            is_completed: false,
          });

        if (insertError) throw insertError;
        setShowOnboarding(true);
      } else if (!data.is_completed) {
        setCompletedSteps(data.completed_steps as string[]);
        setShowOnboarding(true);
      }
    } catch (error) {
      console.error('Error loading onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const completeStep = async (stepId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const newCompletedSteps = [...completedSteps, stepId];
      setCompletedSteps(newCompletedSteps);

      const { error } = await supabase
        .from('user_onboarding')
        .update({
          completed_steps: newCompletedSteps,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('onboarding_version', CURRENT_VERSION);

      if (error) throw error;
    } catch (error) {
      console.error('Error completing step:', error);
    }
  };

  const completeOnboarding = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from('user_onboarding')
        .update({
          is_completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('onboarding_version', CURRENT_VERSION);

      if (error) throw error;

      setShowOnboarding(false);
      toast({
        title: 'Welcome aboard!',
        description: 'You can always access help from the menu.',
      });
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  };

  const skipOnboarding = async () => {
    await completeOnboarding();
  };

  const nextStep = async (steps: OnboardingStep[]) => {
    if (currentStep < steps.length - 1) {
      await completeStep(steps[currentStep].id);
      setCurrentStep(currentStep + 1);
    } else {
      await completeStep(steps[currentStep].id);
      await completeOnboarding();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return {
    isLoading,
    showOnboarding,
    currentStep,
    completedSteps,
    nextStep,
    previousStep,
    skipOnboarding,
    setShowOnboarding,
  };
}
