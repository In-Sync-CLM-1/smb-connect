-- Enable realtime for chat_participants table so updates trigger subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;