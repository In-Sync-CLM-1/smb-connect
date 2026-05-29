import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, ChevronDown, Link2, Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface UtmLinkGeneratorProps {
  slug: string;
}

interface CustomParam {
  id: string;
  key: string;
  value: string;
}

const PRESETS = [
  { name: 'WhatsApp', source: 'whatsapp', medium: 'social', icon: '💬' },
  { name: 'Email', source: 'email', medium: 'email', icon: '📧' },
  { name: 'LinkedIn', source: 'linkedin', medium: 'social', icon: '💼' },
  { name: 'Facebook', source: 'facebook', medium: 'social', icon: '👍' },
  { name: 'Twitter/X', source: 'twitter', medium: 'social', icon: '🐦' },
];

const PRODUCTION_DOMAIN = 'smbconnect.in';

export const UtmLinkGenerator = ({ slug }: UtmLinkGeneratorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [utmTerm, setUtmTerm] = useState('');
  const [utmContent, setUtmContent] = useState('');
  const [customParams, setCustomParams] = useState<CustomParam[]>([]);
  const [useProductionDomain, setUseProductionDomain] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatedUrl = useMemo(() => {
    if (!slug) return '';
    
    const base = useProductionDomain 
      ? `https://${PRODUCTION_DOMAIN}/event/${slug}`
      : `${window.location.origin}/event/${slug}`;
    
    const params: string[] = [];
    if (utmSource) params.push(`utm_source=${encodeURIComponent(utmSource)}`);
    if (utmMedium) params.push(`utm_medium=${encodeURIComponent(utmMedium)}`);
    if (utmCampaign) params.push(`utm_campaign=${encodeURIComponent(utmCampaign)}`);
    if (utmTerm) params.push(`utm_term=${encodeURIComponent(utmTerm)}`);
    if (utmContent) params.push(`utm_content=${encodeURIComponent(utmContent)}`);
    
    // Add custom parameters
    customParams.forEach(param => {
      if (param.key && param.value) {
        params.push(`${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`);
      }
    });
    
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }, [slug, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, customParams, useProductionDomain]);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setUtmSource(preset.source);
    setUtmMedium(preset.medium);
    if (!utmCampaign && slug) {
      setUtmCampaign(slug);
    }
  };

  const copyToClipboard = async () => {
    if (!generatedUrl) return;
    
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  const clearFields = () => {
    setUtmSource('');
    setUtmMedium('');
    setUtmCampaign('');
    setUtmTerm('');
    setUtmContent('');
    setCustomParams([]);
  };

  const addCustomParam = () => {
    setCustomParams([
      ...customParams,
      { id: crypto.randomUUID(), key: '', value: '' }
    ]);
  };

  const updateCustomParam = (id: string, field: 'key' | 'value', value: string) => {
    setCustomParams(customParams.map(param => 
      param.id === id 
        ? { ...param, [field]: field === 'key' ? value.toLowerCase().replace(/\s/g, '_') : value }
        : param
    ));
  };

  const removeCustomParam = (id: string) => {
    setCustomParams(customParams.filter(param => param.id !== id));
  };

  if (!slug) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between border-dashed"
          type="button"
        >
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span>🔗 UTM Link Generator</span>
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </Button>
      </CollapsibleTrigger>
      
      <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-lg bg-muted/30">
        {/* Quick Presets */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Quick Presets</Label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.name}
                variant="outline"
                size="sm"
                onClick={() => applyPreset(preset)}
                type="button"
                className="text-xs"
              >
                <span className="mr-1">{preset.icon}</span>
                {preset.name}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFields}
              type="button"
              className="text-xs text-muted-foreground"
            >
              Clear All
            </Button>
          </div>
        </div>

        {/* Standard UTM Fields - Row 1 */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="gen-utm-source">UTM Source *</Label>
            <Input
              id="gen-utm-source"
              placeholder="e.g., whatsapp, email"
              value={utmSource}
              onChange={(e) => setUtmSource(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-utm-medium">UTM Medium *</Label>
            <Input
              id="gen-utm-medium"
              placeholder="e.g., social, email, cpc"
              value={utmMedium}
              onChange={(e) => setUtmMedium(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-utm-campaign">UTM Campaign *</Label>
            <Input
              id="gen-utm-campaign"
              placeholder="e.g., summit-2025"
              value={utmCampaign}
              onChange={(e) => setUtmCampaign(e.target.value.toLowerCase().replace(/\s/g, '-'))}
            />
          </div>
        </div>

        {/* Standard UTM Fields - Row 2 (Optional) */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gen-utm-term">
              UTM Term <span className="text-muted-foreground text-xs">(optional - for paid keywords)</span>
            </Label>
            <Input
              id="gen-utm-term"
              placeholder="e.g., running+shoes, marketing+tips"
              value={utmTerm}
              onChange={(e) => setUtmTerm(e.target.value.toLowerCase().replace(/\s/g, '+'))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-utm-content">
              UTM Content <span className="text-muted-foreground text-xs">(optional - for A/B testing)</span>
            </Label>
            <Input
              id="gen-utm-content"
              placeholder="e.g., banner_ad, text_link"
              value={utmContent}
              onChange={(e) => setUtmContent(e.target.value.toLowerCase().replace(/\s/g, '_'))}
            />
          </div>
        </div>

        {/* Custom Parameters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Custom Parameters</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={addCustomParam}
              type="button"
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Parameter
            </Button>
          </div>
          
          {customParams.length > 0 && (
            <div className="space-y-2">
              {customParams.map((param) => (
                <div key={param.id} className="flex gap-2 items-center">
                  <Input
                    placeholder="Parameter name"
                    value={param.key}
                    onChange={(e) => updateCustomParam(param.id, 'key', e.target.value)}
                    className="flex-1"
                  />
                  <span className="text-muted-foreground">=</span>
                  <Input
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => updateCustomParam(param.id, 'value', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCustomParam(param.id)}
                    type="button"
                    className="shrink-0 h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {customParams.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Add custom tracking parameters beyond the standard UTM fields if needed.
            </p>
          )}
        </div>

        {/* Domain Toggle */}
        <div className="flex items-center gap-3 py-2">
          <Switch
            id="use-production-domain"
            checked={useProductionDomain}
            onCheckedChange={setUseProductionDomain}
          />
          <Label htmlFor="use-production-domain" className="text-sm cursor-pointer">
            Use production domain ({PRODUCTION_DOMAIN})
          </Label>
        </div>

        {/* Generated URL */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Generated URL</Label>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-background border rounded-md font-mono text-xs break-all select-all">
              {generatedUrl || 'Enter UTM parameters to generate URL'}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={copyToClipboard}
              disabled={!generatedUrl}
              type="button"
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Share this URL to track registrations from different channels. Analytics will show in the Event Registrations report.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
