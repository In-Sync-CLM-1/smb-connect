import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOwnershipScope } from '@/hooks/useOwnershipScope';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, Eye, Save, Loader2, Copy, ExternalLink, Plus, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import DOMPurify from 'dompurify';
import { UtmLinkGenerator } from '@/components/admin/UtmLinkGenerator';

interface PageData {
  id: string;
  title: string;
  slug: string;
  htmlContent: string;
  sortOrder: number;
  isDefault: boolean;
}

const CreateLandingPage = () => {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const scope = useOwnershipScope();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [cssContent, setCssContent] = useState('');
  const [associationId, setAssociationId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [registrationFee, setRegistrationFee] = useState<string>('');
  const [activeTab, setActiveTab] = useState('edit');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  
  // Event details for email template
  const [eventDate, setEventDate] = useState<string>('');
  const [eventTime, setEventTime] = useState<string>('');
  const [eventVenue, setEventVenue] = useState<string>('');
  
  // Default UTM parameters
  const [defaultUtmSource, setDefaultUtmSource] = useState<string>('');
  const [defaultUtmMedium, setDefaultUtmMedium] = useState<string>('');
  const [defaultUtmCampaign, setDefaultUtmCampaign] = useState<string>('');
  
  // Multi-page state
  const [pages, setPages] = useState<PageData[]>([
    { id: 'temp-1', title: 'Home', slug: '', htmlContent: '', sortOrder: 0, isDefault: true }
  ]);
  const [activePageIndex, setActivePageIndex] = useState(0);

  // Auto-bind ownership from the route context (association/company dashboards)
  useEffect(() => {
    if (!isEditing) {
      if (scope.scope === 'association' && scope.associationId) {
        setAssociationId(scope.associationId);
        setCompanyId('');
      } else if (scope.scope === 'company' && scope.companyId) {
        setCompanyId(scope.companyId);
        setAssociationId('');
      }
    }
  }, [scope.scope, scope.associationId, scope.companyId, isEditing]);

  // Fetch associations for dropdown (admin only)
  const { data: associations } = useQuery({
    queryKey: ['associations-for-landing-page'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('associations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: scope.scope === 'admin',
  });

  // Fetch existing landing page if editing
  const { data: existingPage, isLoading: isLoadingPage } = useQuery({
    queryKey: ['landing-page', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('event_landing_pages')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  // Fetch existing pages for this landing page
  const { data: existingPages, isLoading: isLoadingPages } = useQuery({
    queryKey: ['landing-page-pages', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('event_landing_page_pages')
        .select('*')
        .eq('landing_page_id', id)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: isEditing,
  });

  // Populate form when editing
  useEffect(() => {
    if (existingPage) {
      setTitle(existingPage.title);
      setSlug(existingPage.slug);
      setCssContent(existingPage.css_content || '');
      setAssociationId(existingPage.association_id || '');
      setCompanyId((existingPage as any).company_id || '');
      setIsActive(existingPage.is_active);
      setRegistrationEnabled(existingPage.registration_enabled);
      setRegistrationFee(existingPage.registration_fee?.toString() || '');
      setSlugManuallyEdited(true);
      // Event details
      setEventDate((existingPage as any).event_date || '');
      setEventTime((existingPage as any).event_time || '');
      setEventVenue((existingPage as any).event_venue || '');
      // UTM defaults
      setDefaultUtmSource((existingPage as any).default_utm_source || '');
      setDefaultUtmMedium((existingPage as any).default_utm_medium || '');
      setDefaultUtmCampaign((existingPage as any).default_utm_campaign || '');
    }
  }, [existingPage]);

  // Populate pages when editing
  useEffect(() => {
    if (existingPages && existingPages.length > 0) {
      setPages(existingPages.map(p => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        htmlContent: p.html_content,
        sortOrder: p.sort_order,
        isDefault: p.is_default
      })));
    }
  }, [existingPages]);

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManuallyEdited && title) {
      const generatedSlug = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setSlug(generatedSlug);
    }
  }, [title, slugManuallyEdited]);

  const activePage = pages[activePageIndex];
  const hasAnyContent = pages.some(p => p.htmlContent.trim().length > 0);

  const updatePageField = (index: number, field: keyof PageData, value: string | boolean | number) => {
    setPages(prev => prev.map((p, i) => 
      i === index ? { ...p, [field]: value } : p
    ));
  };

  const addPage = () => {
    const newPage: PageData = {
      id: `temp-${Date.now()}`,
      title: `Page ${pages.length + 1}`,
      slug: `page-${pages.length + 1}`,
      htmlContent: '',
      sortOrder: pages.length,
      isDefault: false
    };
    setPages([...pages, newPage]);
    setActivePageIndex(pages.length);
  };

  const removePage = (index: number) => {
    if (pages[index].isDefault) {
      toast.error('Cannot remove the default page');
      return;
    }
    if (pages.length <= 1) {
      toast.error('Must have at least one page');
      return;
    }
    setPages(prev => prev.filter((_, i) => i !== index));
    if (activePageIndex >= index && activePageIndex > 0) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  const setAsDefault = (index: number) => {
    setPages(prev => prev.map((p, i) => ({
      ...p,
      isDefault: i === index,
      slug: i === index ? '' : (p.slug || p.title.toLowerCase().replace(/[^a-z0-9]/g, '-'))
    })));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title || !slug || (!associationId && !companyId)) {
        throw new Error('Please fill in all required fields');
      }

      if (!hasAnyContent) {
        throw new Error('At least one page must have HTML content');
      }

      // Validate CSS size (2MB limit)
      if (cssContent.length > 2 * 1024 * 1024) {
        throw new Error('CSS content exceeds 2MB limit');
      }

      // Validate each page's HTML size (5MB limit)
      for (const page of pages) {
        if (page.htmlContent.length > 5 * 1024 * 1024) {
          throw new Error(`HTML content for "${page.title}" exceeds 5MB limit`);
        }
      }

      // Ensure we have a default page
      const hasDefault = pages.some(p => p.isDefault);
      if (!hasDefault) {
        throw new Error('One page must be set as the default');
      }

      const landingPageData = {
        title,
        slug,
        html_content: pages.find(p => p.isDefault)?.htmlContent || '', // Keep for backward compatibility
        css_content: cssContent || null,
        association_id: associationId || null,
        company_id: companyId || null,
        is_active: isActive,
        registration_enabled: registrationEnabled,
        registration_fee: registrationFee ? parseFloat(registrationFee) : null,
        event_date: eventDate || null,
        event_time: eventTime || null,
        event_venue: eventVenue || null,
        default_utm_source: defaultUtmSource || null,
        default_utm_medium: defaultUtmMedium || null,
        default_utm_campaign: defaultUtmCampaign || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      };

      // Get the linked event_id from existing page (if editing) to sync venue/location
      const eventId = isEditing ? (existingPage as any)?.event_id : null;

      let landingPageId = id;

      if (isEditing && id) {
        const { error } = await supabase
          .from('event_landing_pages')
          .update(landingPageData)
          .eq('id', id);
        if (error) throw error;

        // Sync venue/location to linked events calendar if event_id exists
        if (eventId && eventVenue) {
          await supabase
            .from('events')
            .update({ 
              location: eventVenue,
              updated_at: new Date().toISOString()
            })
            .eq('id', eventId);
        }
      } else {
        const { data, error } = await supabase
          .from('event_landing_pages')
          .insert(landingPageData)
          .select('id')
          .single();
        if (error) {
          if (error.code === '23505') {
            throw new Error('A landing page with this URL slug already exists');
          }
          throw error;
        }
        landingPageId = data.id;
      }

      // Handle pages - delete existing and insert new
      if (isEditing && id) {
        await supabase
          .from('event_landing_page_pages')
          .delete()
          .eq('landing_page_id', id);
      }

      // Insert all pages
      const pagesData = pages.map((page, index) => ({
        landing_page_id: landingPageId,
        title: page.title,
        slug: page.isDefault ? '' : page.slug,
        html_content: page.htmlContent,
        sort_order: index,
        is_default: page.isDefault
      }));

      const { error: pagesError } = await supabase
        .from('event_landing_page_pages')
        .insert(pagesData);
      
      if (pagesError) throw pagesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['landing-pages'] });
      toast.success(isEditing ? 'Landing page updated' : 'Landing page created');
      navigate(`${scope.basePath}/event-landing-pages`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleHtmlFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast.error('Please upload an HTML file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size exceeds 5MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      updatePageField(activePageIndex, 'htmlContent', content);
      toast.success('HTML file loaded');
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleCssFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.css')) {
      toast.error('Please upload a CSS file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size exceeds 2MB limit');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCssContent(content);
      toast.success('CSS file loaded');
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsText(file);
  };

  const copyUrl = (pageSlug?: string) => {
    const subPath = pageSlug ? `/${pageSlug}` : '';
    const url = `${window.location.origin}/event/${slug}${subPath}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copied to clipboard');
  };

  const getSanitizedPreviewHtml = () => {
    let html = DOMPurify.sanitize(activePage?.htmlContent || '', {
      ADD_TAGS: ['style', 'link'],
      ADD_ATTR: ['target'],
      WHOLE_DOCUMENT: true,
    });

    // Inject CSS if present
    if (cssContent) {
      const styleTag = `<style>${cssContent}</style>`;
      if (html.includes('</head>')) {
        html = html.replace('</head>', styleTag + '</head>');
      } else if (html.includes('<body>')) {
        html = html.replace('<body>', '<head>' + styleTag + '</head><body>');
      } else {
        html = styleTag + html;
      }
    }

    return html;
  };

  if (isEditing && (isLoadingPage || isLoadingPages)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-5xl">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate(`${scope.basePath}/event-landing-pages`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Landing Pages
      </Button>

      <PageHeader
        title={isEditing ? 'Edit Landing Page' : 'Create Landing Page'}
        description="Create multi-page event landing pages with automatic user registration"
      />

      <div className="space-y-6 mt-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Configure the landing page details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title *</Label>
                <Input
                  id="title"
                  placeholder="Annual Summit 2025"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    placeholder="annual-summit-2025"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                      setSlugManuallyEdited(true);
                    }}
                  />
                  {slug && (
                    <Button variant="outline" size="icon" onClick={() => copyUrl()}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {slug && (
                  <p className="text-xs text-muted-foreground">
                    URL: {window.location.origin}/event/{slug}
                  </p>
                )}
              </div>
            </div>

            {scope.scope === 'admin' && (
              <div className="space-y-2">
                <Label htmlFor="association">Association *</Label>
                <Select value={associationId} onValueChange={setAssociationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an association" />
                  </SelectTrigger>
                  <SelectContent>
                    {associations?.map((assoc) => (
                      <SelectItem key={assoc.id} value={assoc.id}>
                        {assoc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is-active">Page is active and publicly accessible</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="registration-enabled"
                  checked={registrationEnabled}
                  onCheckedChange={setRegistrationEnabled}
                />
                <Label htmlFor="registration-enabled">Enable user registration</Label>
              </div>
            </div>

            {registrationEnabled && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="registration-fee">Registration Fee (₹)</Label>
                  <Input
                    id="registration-fee"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0 for free events"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                    className="max-w-[200px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty or enter 0 for free events. Coupon codes can be applied if a fee is set.
                  </p>
                </div>

                {/* Event Details for Email Template */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">Event Details (for confirmation email)</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="event-date">Event Date</Label>
                      <Input
                        id="event-date"
                        type="date"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-time">Event Time</Label>
                      <Input
                        id="event-time"
                        type="text"
                        placeholder="e.g., 10:00 AM – 2:30 PM"
                        value={eventTime}
                        onChange={(e) => setEventTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event-venue">Event Venue / Location</Label>
                      <Input
                        id="event-venue"
                        type="text"
                        placeholder="e.g., Bangalore"
                        value={eventVenue}
                        onChange={(e) => setEventVenue(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    These details will be included in the registration confirmation email. Location updates sync to the events calendar.
                  </p>
                </div>

                {/* Default UTM Parameters */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">📊 Default UTM Parameters (for tracking)</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="utm-source">Default UTM Source</Label>
                      <Input
                        id="utm-source"
                        type="text"
                        placeholder="e.g., website, email, social"
                        value={defaultUtmSource}
                        onChange={(e) => setDefaultUtmSource(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="utm-medium">Default UTM Medium</Label>
                      <Input
                        id="utm-medium"
                        type="text"
                        placeholder="e.g., organic, cpc, referral"
                        value={defaultUtmMedium}
                        onChange={(e) => setDefaultUtmMedium(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="utm-campaign">Default UTM Campaign</Label>
                      <Input
                        id="utm-campaign"
                        type="text"
                        placeholder="e.g., summit-2025, launch"
                        value={defaultUtmCampaign}
                        onChange={(e) => setDefaultUtmCampaign(e.target.value)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Default values used when registrations don't have UTM parameters. URL parameters (utm_source, utm_medium, utm_campaign) will override these.
                  </p>
                </div>

                {/* UTM Link Generator */}
                <div className="border-t pt-4 mt-4">
                  <UtmLinkGenerator slug={slug} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pages Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pages</CardTitle>
                <CardDescription>
                  Manage multiple pages for your landing page. Each page shares the same CSS.
                </CardDescription>
              </div>
              <Button onClick={addPage} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Page
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Page tabs */}
            <div className="flex flex-wrap gap-2 mb-4 border-b pb-4">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md cursor-pointer border transition-colors ${
                    activePageIndex === index 
                      ? 'bg-primary text-primary-foreground border-primary' 
                      : 'bg-muted hover:bg-accent border-border'
                  }`}
                  onClick={() => setActivePageIndex(index)}
                >
                  <GripVertical className="h-3 w-3 opacity-50" />
                  <span className="text-sm font-medium">
                    {page.title}
                    {page.isDefault && <span className="ml-1 text-xs opacity-70">(Home)</span>}
                  </span>
                  {!page.isDefault && pages.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removePage(index);
                      }}
                      className="ml-1 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Active page settings */}
            {activePage && (
              <div className="space-y-4 mb-4 p-4 bg-muted/50 rounded-lg">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Page Title</Label>
                    <Input
                      value={activePage.title}
                      onChange={(e) => updatePageField(activePageIndex, 'title', e.target.value)}
                      placeholder="Page Title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Page Slug {activePage.isDefault && '(Default page has no slug)'}</Label>
                    <Input
                      value={activePage.slug}
                      onChange={(e) => updatePageField(activePageIndex, 'slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      placeholder={activePage.isDefault ? '(home page)' : 'page-slug'}
                      disabled={activePage.isDefault}
                    />
                    {!activePage.isDefault && slug && activePage.slug && (
                      <p className="text-xs text-muted-foreground">
                        URL: {window.location.origin}/event/{slug}/{activePage.slug}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={activePage.isDefault}
                      onCheckedChange={() => setAsDefault(activePageIndex)}
                      disabled={activePage.isDefault}
                    />
                    <Label className="text-sm">Set as default (home) page</Label>
                  </div>
                  {!activePage.isDefault && activePage.slug && (
                    <Button variant="outline" size="sm" onClick={() => copyUrl(activePage.slug)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy URL
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* HTML/CSS/Preview Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="edit">HTML</TabsTrigger>
                <TabsTrigger value="css">CSS (Shared)</TabsTrigger>
                <TabsTrigger value="preview" disabled={!activePage?.htmlContent}>
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label
                    htmlFor="html-upload"
                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload HTML File
                  </Label>
                  <input
                    id="html-upload"
                    type="file"
                    accept=".html,.htm"
                    className="hidden"
                    onChange={handleHtmlFileUpload}
                  />
                  <span className="text-sm text-muted-foreground">or paste HTML below for "{activePage?.title}"</span>
                </div>

                <Textarea
                  placeholder="<!DOCTYPE html>
<html>
<head>
  <title>Your Event</title>
</head>
<body>
  <!-- Your event content here -->
  <form>
    <input type='text' name='first_name' placeholder='First Name' required />
    <input type='text' name='last_name' placeholder='Last Name' required />
    <input type='email' name='email' placeholder='Email' required />
    <input type='tel' name='phone' placeholder='Phone' />
    <button type='submit'>Register</button>
  </form>
</body>
</html>"
                  className="font-mono text-sm min-h-[400px]"
                  value={activePage?.htmlContent || ''}
                  onChange={(e) => updatePageField(activePageIndex, 'htmlContent', e.target.value)}
                />

                <div className="bg-muted p-4 rounded-lg text-sm">
                  <h4 className="font-medium mb-2">Form Field Names</h4>
                  <p className="text-muted-foreground mb-2">
                    Your HTML form should include these field names for automatic registration:
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li><code className="bg-background px-1 rounded">email</code> - Required</li>
                    <li><code className="bg-background px-1 rounded">first_name</code> or <code className="bg-background px-1 rounded">firstName</code> - Required</li>
                    <li><code className="bg-background px-1 rounded">last_name</code> or <code className="bg-background px-1 rounded">lastName</code> - Required</li>
                    <li><code className="bg-background px-1 rounded">phone</code>, <code className="bg-background px-1 rounded">mobile</code>, or <code className="bg-background px-1 rounded">telephone</code> - Optional</li>
                  </ul>
                </div>

                {registrationEnabled && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">📋 Registration Integration Code</CardTitle>
                      <CardDescription>
                        Copy this snippet into your custom HTML to ensure registrations are captured by the platform — even if your page has its own JavaScript.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="relative">
                        <pre className="bg-background border rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<form id="registration-form">
  <input type="email" name="email" required />
  <input type="text" name="first_name" required />
  <input type="text" name="last_name" required />
  <input type="tel" name="phone" />
  <button type="submit">Register</button>
</form>

<script>
  document.getElementById('registration-form')
    .addEventListener('submit', function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      window.parent.postMessage({
        type: 'event-registration',
        formData: {
          email: fd.get('email'),
          first_name: fd.get('first_name'),
          last_name: fd.get('last_name'),
          phone: fd.get('phone') || ''
        }
      }, '*');
    });
<\/script>`}
                        </pre>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            const snippet = `<form id="registration-form">
  <input type="email" name="email" required />
  <input type="text" name="first_name" required />
  <input type="text" name="last_name" required />
  <input type="tel" name="phone" />
  <button type="submit">Register</button>
</form>

<script>
  document.getElementById('registration-form')
    .addEventListener('submit', function(e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      window.parent.postMessage({
        type: 'event-registration',
        formData: {
          email: fd.get('email'),
          first_name: fd.get('first_name'),
          last_name: fd.get('last_name'),
          phone: fd.get('phone') || ''
        }
      }, '*');
    });
<\/script>`;
                            navigator.clipboard.writeText(snippet);
                            toast.success('Integration code copied to clipboard');
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <strong>Important:</strong> The key line is <code className="bg-background px-1 rounded">window.parent.postMessage</code> with type <code className="bg-background px-1 rounded">'event-registration'</code>.
                        You can adapt the form fields to match your design — just make sure <code className="bg-background px-1 rounded">email</code> and <code className="bg-background px-1 rounded">first_name</code> are always sent.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {registrationEnabled && parseFloat(registrationFee || '0') > 0 && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">💳 Razorpay Payment Button</CardTitle>
                      <CardDescription>
                        For paid events, drop this block into your HTML. The platform auto-hooks the Pay button to open Razorpay, validates the coupon, updates the displayed amount, and shows a success message after payment.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="relative">
                        <pre className="bg-background border rounded-lg p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`<div id="smb-payment-section" style="max-width:480px;margin:24px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;font-family:system-ui,sans-serif;">
  <h3 style="margin:0 0 16px;">Register for the Event</h3>

  <input id="modal-firstname" placeholder="First Name *" required
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-lastname"  placeholder="Last Name"
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-email" type="email" placeholder="Email *" required
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-mobile" placeholder="Mobile Number"
         style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #cbd5e1;border-radius:6px;" />

  <!-- Coupon: validated automatically; updates #modal-amount + #modal-fee-display -->
  <div style="display:flex;gap:8px;margin-bottom:8px;">
    <input id="modal-coupon" placeholder="Coupon code (optional)"
           style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;text-transform:uppercase;" />
    <button type="button" id="modal-apply-coupon"
            style="padding:10px 16px;background:#6366f1;color:#fff;border:0;border-radius:6px;cursor:pointer;">Apply</button>
  </div>
  <div id="modal-coupon-message" style="font-size:13px;margin-bottom:12px;display:none;"></div>

  <!-- Amount display: platform updates this on coupon apply -->
  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8fafc;border-radius:6px;margin-bottom:16px;">
    <span style="color:#64748b;">Amount Payable</span>
    <span id="modal-fee-display" style="font-size:20px;font-weight:700;color:#0f172a;">₹0</span>
  </div>
  <input type="hidden" id="modal-amount" />

  <!-- Pay button: platform hooks click → opens Razorpay → verifies → success -->
  <button type="button" id="modal-pay-btn"
          style="width:100%;padding:14px;background:#1e3a5f;color:#fff;border:0;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">
    Pay & Register
  </button>
</div>`}
                        </pre>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            const snippet = `<div id="smb-payment-section" style="max-width:480px;margin:24px auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;font-family:system-ui,sans-serif;">
  <h3 style="margin:0 0 16px;">Register for the Event</h3>

  <input id="modal-firstname" placeholder="First Name *" required
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-lastname"  placeholder="Last Name"
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-email" type="email" placeholder="Email *" required
         style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #cbd5e1;border-radius:6px;" />
  <input id="modal-mobile" placeholder="Mobile Number"
         style="width:100%;padding:10px;margin-bottom:12px;border:1px solid #cbd5e1;border-radius:6px;" />

  <div style="display:flex;gap:8px;margin-bottom:8px;">
    <input id="modal-coupon" placeholder="Coupon code (optional)"
           style="flex:1;padding:10px;border:1px solid #cbd5e1;border-radius:6px;text-transform:uppercase;" />
    <button type="button" id="modal-apply-coupon"
            style="padding:10px 16px;background:#6366f1;color:#fff;border:0;border-radius:6px;cursor:pointer;">Apply</button>
  </div>
  <div id="modal-coupon-message" style="font-size:13px;margin-bottom:12px;display:none;"></div>

  <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:#f8fafc;border-radius:6px;margin-bottom:16px;">
    <span style="color:#64748b;">Amount Payable</span>
    <span id="modal-fee-display" style="font-size:20px;font-weight:700;color:#0f172a;">₹0</span>
  </div>
  <input type="hidden" id="modal-amount" />

  <button type="button" id="modal-pay-btn"
          style="width:100%;padding:14px;background:#1e3a5f;color:#fff;border:0;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;">
    Pay & Register
  </button>
</div>`;
                            navigator.clipboard.writeText(snippet);
                            toast.success('Payment button code copied to clipboard');
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p><strong>How it works:</strong></p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          <li>The platform auto-detects <code className="bg-background px-1 rounded">#modal-pay-btn</code> and hooks its click.</li>
                          <li>Coupon entered in <code className="bg-background px-1 rounded">#modal-coupon</code> is validated server-side; <code className="bg-background px-1 rounded">#modal-fee-display</code> updates with the discounted amount.</li>
                          <li>On click → Razorpay checkout opens → server verifies the signature → the section is replaced with a "Payment Successful" message.</li>
                          <li>You can keep the IDs and restyle freely — only the IDs are required for the platform to wire things up.</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="css" className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label
                    htmlFor="css-upload"
                    className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload CSS File
                  </Label>
                  <input
                    id="css-upload"
                    type="file"
                    accept=".css"
                    className="hidden"
                    onChange={handleCssFileUpload}
                  />
                  <span className="text-sm text-muted-foreground">CSS applies to all pages</span>
                </div>

                <Textarea
                  placeholder="/* Your custom styles */
body {
  font-family: 'Arial', sans-serif;
  margin: 0;
  padding: 0;
}

.header {
  background: #1a1a1a;
  color: white;
  padding: 20px;
}

.form-input {
  border-radius: 8px;
  padding: 10px;
}"
                  className="font-mono text-sm min-h-[400px]"
                  value={cssContent}
                  onChange={(e) => setCssContent(e.target.value)}
                />

                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>CSS will be injected into all pages when rendered</span>
                  <span>{(cssContent.length / 1024).toFixed(1)} KB / 2048 KB</span>
                </div>
              </TabsContent>

              <TabsContent value="preview">
                {activePage?.htmlContent && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Preview: {activePage.title} (forms are disabled)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const subPath = activePage.isDefault ? '' : `/${activePage.slug}`;
                          window.open(`/event/${slug}${subPath}`, '_blank');
                        }}
                        disabled={!isActive || !slug}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Open in New Tab
                      </Button>
                    </div>
                    <iframe
                      srcDoc={getSanitizedPreviewHtml()}
                      className="w-full h-[600px] border-0"
                      sandbox="allow-same-origin"
                      title="Preview"
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(`${scope.basePath}/event-landing-pages`)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title || !slug || !hasAnyContent || (!associationId && !companyId)}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? 'Update Landing Page' : 'Create Landing Page'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateLandingPage;
