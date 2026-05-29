import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { toast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const error = params.get('error') || hashParams.get('error');
    const errorCode = params.get('error_code') || hashParams.get('error_code');

    if (error && errorCode === 'otp_expired') {
      toast({
        title: 'Reset Link Expired',
        description: 'Your password reset link has expired. Please request a new one from the login page.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return <Navigate to="/auth/login" replace />;
};

export default Index;
