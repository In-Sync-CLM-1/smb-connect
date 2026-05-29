-- Add annual turnover field to companies table
ALTER TABLE public.companies 
ADD COLUMN annual_turnover numeric;