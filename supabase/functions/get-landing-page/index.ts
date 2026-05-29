import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const pageSlug = url.searchParams.get('page') || '';

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for public access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the landing page by slug
    const { data: landingPage, error } = await supabase
      .from('event_landing_pages')
      .select(`
        id,
        title,
        slug,
        html_content,
        css_content,
        is_active,
        registration_enabled,
        registration_fee,
        association_id,
        associations (
          name,
          logo
        )
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (error || !landingPage) {
      console.error('Landing page not found:', error);
      return new Response(
        JSON.stringify({ error: 'Landing page not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all pages for this landing page
    const { data: pages, error: pagesError } = await supabase
      .from('event_landing_page_pages')
      .select('id, title, slug, html_content, sort_order, is_default')
      .eq('landing_page_id', landingPage.id)
      .order('sort_order');

    if (pagesError) {
      console.error('Error fetching pages:', pagesError);
    }

    // Determine which page content to return
    let htmlContent = landingPage.html_content; // Fallback to main html_content
    
    if (pages && pages.length > 0) {
      // Find the requested page or default page
      let targetPage;
      
      if (pageSlug) {
        // Looking for a specific sub-page
        targetPage = pages.find(p => p.slug === pageSlug);
      } else {
        // Looking for the default (home) page
        targetPage = pages.find(p => p.is_default) || pages[0];
      }

      if (targetPage) {
        htmlContent = targetPage.html_content;
      } else if (pageSlug) {
        // Requested a specific page that doesn't exist
        return new Response(
          JSON.stringify({ error: 'Page not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return page info for navigation
    const pageInfo = pages?.map(p => ({
      slug: p.slug,
      title: p.title,
      is_default: p.is_default
    })) || [];

    return new Response(
      JSON.stringify({
        id: landingPage.id,
        title: landingPage.title,
        slug: landingPage.slug,
        html_content: htmlContent,
        css_content: landingPage.css_content,
        registration_enabled: landingPage.registration_enabled,
        registration_fee: landingPage.registration_fee,
        pages: pageInfo,
        association: landingPage.associations
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-landing-page:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
