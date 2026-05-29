import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching link preview for:', url);

    // Validate URL format
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the page
    const response = await fetch(validUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch URL:', response.status);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch URL' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Extract Open Graph meta tags
    const getMetaContent = (property: string): string | null => {
      // Try og: tags first
      const ogMatch = html.match(new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'));
      
      if (ogMatch) return ogMatch[1];

      // Try twitter: tags
      const twitterMatch = html.match(new RegExp(`<meta[^>]*name=["']twitter:${property}["'][^>]*content=["']([^"']*)["']`, 'i'))
        || html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']twitter:${property}["']`, 'i'));
      
      if (twitterMatch) return twitterMatch[1];

      // Try standard meta tags for description
      if (property === 'description') {
        const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
          || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
        if (descMatch) return descMatch[1];
      }

      return null;
    };

    // Get title from og:title, twitter:title, or <title> tag
    let title = getMetaContent('title');
    if (!title) {
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      title = titleMatch ? titleMatch[1].trim() : null;
    }

    const description = getMetaContent('description');
    let image = getMetaContent('image');

    // Make image URL absolute if it's relative
    if (image && !image.startsWith('http')) {
      if (image.startsWith('//')) {
        image = `${validUrl.protocol}${image}`;
      } else if (image.startsWith('/')) {
        image = `${validUrl.origin}${image}`;
      } else {
        image = `${validUrl.origin}/${image}`;
      }
    }

    const preview = {
      title: title || validUrl.hostname,
      description: description || null,
      image: image || null,
      url: validUrl.toString(),
    };

    console.log('Link preview extracted:', preview);

    return new Response(
      JSON.stringify(preview),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching link preview:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch link preview' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
