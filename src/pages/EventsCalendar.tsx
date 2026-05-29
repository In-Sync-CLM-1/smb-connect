import { useEffect, useState, useRef } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ArrowLeft, Link as LinkIcon, Image, X, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { validatePostImageUpload } from '@/lib/uploadValidation';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface Event {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  location: string | null;
  event_type: string | null;
  created_by: string;
  event_link: string | null;
  thumbnail_url: string | null;
  link_preview_title: string | null;
  link_preview_description: string | null;
  link_preview_image: string | null;
  // Landing page events
  source?: 'calendar' | 'landing_page';
  slug?: string;
  event_time?: string | null;
  association_name?: string | null;
  allDay?: boolean;
}

interface LinkPreview {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
}

export default function EventsCalendar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin } = useUserRole();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    location: '',
    event_type: '',
    event_link: '',
  });
  
  // Thumbnail and link preview states
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);

      // Fetch both sources in parallel
      const [calendarRes, landingRes] = await Promise.all([
        supabase
          .from('events')
          .select('*')
          .order('start_date', { ascending: true }),
        supabase
          .from('event_landing_pages')
          .select('id, title, slug, event_date, event_time, event_venue, is_active, created_by, association_id, associations(name)')
          .eq('is_active', true)
          .not('event_date', 'is', null),
      ]);

      if (calendarRes.error) throw calendarRes.error;

      // Calendar events (existing source)
      const calendarEvents: Event[] = (calendarRes.data || []).map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        start: new Date(event.start_date),
        end: new Date(event.end_date),
        location: event.location,
        event_type: event.event_type,
        created_by: event.created_by,
        event_link: event.event_link,
        thumbnail_url: event.thumbnail_url,
        link_preview_title: event.link_preview_title,
        link_preview_description: event.link_preview_description,
        link_preview_image: event.link_preview_image,
        source: 'calendar' as const,
      }));

      // Landing page events (new source)
      const landingEvents: Event[] = (landingRes.data || []).map((lp: any) => {
        const eventDate = new Date(lp.event_date + 'T00:00:00');
        const endDate = new Date(lp.event_date + 'T23:59:59');
        const assocName = lp.associations?.name || null;
        return {
          id: `lp-${lp.id}`,
          title: lp.title,
          description: lp.event_time ? `Time: ${lp.event_time}` : null,
          start: eventDate,
          end: endDate,
          location: lp.event_venue,
          event_type: 'landing_page',
          created_by: lp.created_by,
          event_link: `/event/${lp.slug}`,
          thumbnail_url: null,
          link_preview_title: null,
          link_preview_description: null,
          link_preview_image: null,
          source: 'landing_page' as const,
          slug: lp.slug,
          event_time: lp.event_time,
          association_name: assocName,
          allDay: true,
        };
      });

      setEvents([...calendarEvents, ...landingEvents]);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetFormState = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setExistingThumbnail(null);
    setLinkPreview(null);
  };

  const handleSelectEvent = (event: Event) => {
    // Landing page events → navigate to the event page
    if (event.source === 'landing_page' && event.slug) {
      navigate(`/event/${event.slug}`);
      return;
    }

    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      start_date: format(event.start, "yyyy-MM-dd'T'HH:mm"),
      end_date: format(event.end, "yyyy-MM-dd'T'HH:mm"),
      location: event.location || '',
      event_type: event.event_type || '',
      event_link: event.event_link || '',
    });
    setExistingThumbnail(event.thumbnail_url);
    if (event.link_preview_title || event.link_preview_image) {
      setLinkPreview({
        title: event.link_preview_title,
        description: event.link_preview_description,
        image: event.link_preview_image,
        url: event.event_link || '',
      });
    } else {
      setLinkPreview(null);
    }
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setDialogOpen(true);
  };

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    if (!isSuperAdmin) return;
    setSelectedEvent(null);
    setFormData({
      title: '',
      description: '',
      start_date: format(start, "yyyy-MM-dd'T'HH:mm"),
      end_date: format(end, "yyyy-MM-dd'T'HH:mm"),
      location: '',
      event_type: '',
      event_link: '',
    });
    resetFormState();
    setDialogOpen(true);
  };

  const handleFetchLinkPreview = async () => {
    if (!formData.event_link.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a URL first',
        variant: 'destructive',
      });
      return;
    }

    setFetchingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
        body: { url: formData.event_link },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setLinkPreview(data);
      toast({
        title: 'Success',
        description: 'Link preview fetched successfully',
      });
    } catch (error: any) {
      console.error('Error fetching link preview:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch link preview',
        variant: 'destructive',
      });
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleThumbnailSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = await validatePostImageUpload(file);
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const removeThumbnail = () => {
    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
    }
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setExistingThumbnail(null);
    if (thumbnailInputRef.current) {
      thumbnailInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let thumbnailUrl = existingThumbnail;

      // Upload thumbnail if new file selected
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('event-media')
          .upload(fileName, thumbnailFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('event-media')
          .getPublicUrl(fileName);

        thumbnailUrl = publicUrl;
      }

      const eventData = {
        title: formData.title,
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        location: formData.location || null,
        event_type: formData.event_type || null,
        event_link: formData.event_link || null,
        thumbnail_url: thumbnailUrl,
        link_preview_title: linkPreview?.title || null,
        link_preview_description: linkPreview?.description || null,
        link_preview_image: linkPreview?.image || null,
      };

      if (selectedEvent) {
        // Update existing event
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', selectedEvent.id);

        if (error) throw error;
      } else {
        // Create new event
        const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
        if (!user) throw new Error('Not authenticated');

        const { error } = await supabase
          .from('events')
          .insert([{
            ...eventData,
            created_by: user.id,
          }]);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: `Event ${selectedEvent ? 'updated' : 'created'} successfully`,
      });

      setDialogOpen(false);
      resetFormState();
      loadEvents();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save event',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', selectedEvent.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Event deleted successfully',
      });

      setDialogOpen(false);
      resetFormState();
      loadEvents();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete event',
        variant: 'destructive',
      });
    }
  };

  // Get display thumbnail (uploaded > existing > link preview)
  const displayThumbnail = thumbnailPreview || existingThumbnail || linkPreview?.image;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto py-4 md:pl-20 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Events Calendar</h1>
          {isSuperAdmin && (
            <Button onClick={() => {
              setSelectedEvent(null);
              setFormData({
                title: '',
                description: '',
                start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                end_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                location: '',
                event_type: '',
                event_link: '',
              });
              resetFormState();
              setDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          )}
          {!isSuperAdmin && <div className="w-32" />}
        </div>
      </header>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetFormState();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date & Time *</Label>
                <Input
                  id="start_date"
                  type="datetime-local"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">End Date & Time *</Label>
                <Input
                  id="end_date"
                  type="datetime-local"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Conference Room A, Online, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_type">Event Type</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value) => setFormData({ ...formData, event_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="conference">Conference</SelectItem>
                  <SelectItem value="webinar">Webinar</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="social">Social Event</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Event Link with Preview */}
            <div className="space-y-2">
              <Label htmlFor="event_link">Event Link</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="event_link"
                    value={formData.event_link}
                    onChange={(e) => setFormData({ ...formData, event_link: e.target.value })}
                    placeholder="https://example.com/event"
                    className="pl-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleFetchLinkPreview}
                  disabled={fetchingPreview || !formData.event_link.trim()}
                >
                  {fetchingPreview ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Fetch Preview'
                  )}
                </Button>
              </div>
              
              {/* Link Preview Card */}
              {linkPreview && (
                <div className="mt-2 border rounded-lg p-3 bg-muted/50">
                  <div className="flex items-start gap-3">
                    {linkPreview.image && (
                      <img 
                        src={linkPreview.image} 
                        alt="Link preview" 
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{linkPreview.title}</p>
                      {linkPreview.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {linkPreview.description}
                        </p>
                      )}
                      <a 
                        href={linkPreview.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {new URL(linkPreview.url).hostname}
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setLinkPreview(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Thumbnail Upload */}
            <div className="space-y-2">
              <Label>Event Thumbnail</Label>
              <p className="text-xs text-muted-foreground">Upload a custom thumbnail (max 10MB). If not uploaded, the link preview image will be used.</p>
              
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
              />
              
              {displayThumbnail ? (
                <div className="relative inline-block">
                  <img 
                    src={displayThumbnail} 
                    alt="Thumbnail preview" 
                    className="max-w-xs h-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={removeThumbnail}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  {(thumbnailPreview || existingThumbnail) && (
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                      Custom
                    </span>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => thumbnailInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Upload Thumbnail
                </Button>
              )}
            </div>

            <div className="flex justify-between gap-2 pt-4">
              <div>
                {selectedEvent && isSuperAdmin && (
                  <Button type="button" variant="destructive" onClick={handleDelete}>
                    Delete Event
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                {isSuperAdmin && (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      `${selectedEvent ? 'Update' : 'Create'} Event`
                    )}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto py-4 md:py-6 md:pl-20">
        <div className="bg-card rounded-lg p-4 shadow-sm" style={{ height: 'calc(100vh - 180px)' }}>
          <style>{`
            .rbc-event {
              cursor: pointer !important;
            }
            .rbc-event:hover {
              opacity: 0.8;
            }
          `}</style>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            onSelectSlot={isSuperAdmin ? handleSelectSlot : undefined}
            selectable={isSuperAdmin}
            popup
            views={['month', 'week', 'day', 'agenda']}
            defaultView="month"
            style={{ height: '100%' }}
            eventPropGetter={(event: Event) => ({
              style: event.source === 'landing_page'
                ? { backgroundColor: '#16a34a', borderColor: '#15803d' }
                : undefined,
            })}
            tooltipAccessor={(event: Event) =>
              event.source === 'landing_page'
                ? `${event.title}${event.association_name ? ` — ${event.association_name}` : ''}${event.event_time ? `\n${event.event_time}` : ''}${event.location ? `\n${event.location}` : ''}`
                : event.title
            }
          />
        </div>
      </main>
    </div>
  );
}
