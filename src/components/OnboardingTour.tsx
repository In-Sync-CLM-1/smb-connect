import { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { OnboardingStep } from '@/hooks/useOnboarding';

interface OnboardingTourProps {
  steps: OnboardingStep[];
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
}

export function OnboardingTour({
  steps,
  currentStep,
  onNext,
  onPrevious,
  onSkip,
}: OnboardingTourProps) {
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  useEffect(() => {
    if (step?.target) {
      const element = document.querySelector(step.target);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        
        return () => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        };
      }
    }
  }, [step]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-lg mx-4 animate-scale-in shadow-xl">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Step {currentStep + 1} of {steps.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <CardTitle className="text-2xl">{step.title}</CardTitle>
            <CardDescription className="text-base">
              {step.description}
            </CardDescription>
          </div>
          
          {step.action && (
            <Button onClick={step.action} className="w-full" variant="outline">
              Try it now
            </Button>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={isFirstStep}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          <Button
            onClick={onNext}
            className="flex-1"
          >
            {isLastStep ? 'Finish' : 'Next'}
            {!isLastStep && <ChevronRight className="h-4 w-4 ml-2" />}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
