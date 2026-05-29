ALTER TABLE public.profiles DROP CONSTRAINT employment_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT employment_status_check 
  CHECK (employment_status IS NULL OR employment_status = ANY(ARRAY[
    'currently_working', 'open_to_opportunities', 'actively_looking', 
    'hiring', 'not_looking', 'open_to_consulting', 'available_for_freelance'
  ]));