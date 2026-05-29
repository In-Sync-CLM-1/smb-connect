import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openRazorpayCheckout } from '@/lib/razorpay';


interface PageInfo {
  slug: string;
  title: string;
  is_default: boolean;
}

interface LandingPageData {
  id: string;
  title: string;
  slug: string;
  html_content: string;
  css_content?: string | null;
  registration_enabled: boolean;
  registration_fee?: number | null;
  pages: PageInfo[];
  association: {
    name: string;
    logo: string | null;
  } | null;
}

// Session cache for instant loading on repeat visits (low-network users)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedPage(slug: string, subPage: string): LandingPageData | null {
  try {
    const raw = sessionStorage.getItem(`smb_lp_${slug}_${subPage}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`smb_lp_${slug}_${subPage}`);
      return null;
    }
    return data;
  } catch { return null; }
}

function setCachedPage(slug: string, subPage: string, data: LandingPageData): void {
  try {
    sessionStorage.setItem(`smb_lp_${slug}_${subPage}`, JSON.stringify({ data, ts: Date.now() }));
  } catch { /* ignore quota errors */ }
}

// Headers for edge functions still used (process-event-registration)
const EDGE_FUNCTION_HEADERS = {
  'Content-Type': 'application/json',
  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const EventLandingPageView = () => {
  const { slug, subPage } = useParams<{ slug: string; subPage?: string }>();
  const [landingPage, setLandingPage] = useState<LandingPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [registrationMessage, setRegistrationMessage] = useState<string>('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const registrationInFlight = useRef(false);
  const landingPageRef = useRef<LandingPageData | null>(null);

  useEffect(() => {
    const fetchLandingPage = async () => {
      if (!slug) {
        setError('Invalid page URL');
        setLoading(false);
        return;
      }

      // Instant load from session cache (helps low-network users)
      const cached = getCachedPage(slug, subPage || '');
      if (cached) {
        setLandingPage(cached);
        landingPageRef.current = cached;
        setLoading(false);
      }

      try {
        // RPC call — single PostgREST roundtrip, no edge function cold start
        const { data: pageData, error: rpcError } = await supabase
          .rpc('get_landing_page' as any, {
            p_slug: slug,
            p_page_slug: subPage || '',
          });

        if (rpcError) {
          if (!cached) setError('Failed to load event page');
          return;
        }

        if (pageData?.error) {
          if (!cached) setError(pageData.error === 'Page not found' || pageData.error === 'Landing page not found'
            ? 'Event page not found' : 'Failed to load event page');
          return;
        }

        setLandingPage(pageData);
        landingPageRef.current = pageData;
        setCachedPage(slug, subPage || '', pageData);
      } catch (err) {
        console.error('Error fetching landing page:', err);
        if (!cached) setError('Failed to load event page');
      } finally {
        setLoading(false);
      }
    };

    fetchLandingPage();
  }, [slug, subPage]);

  // Handle form submissions from the iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'event-registration') {
        const formData = event.data.data;

        // Use ref to avoid stale closure over landingPage state
        const currentPage = landingPageRef.current;
        if (!currentPage) return;

        // Prevent duplicate submissions (race condition: iframe can fire multiple messages)
        if (registrationInFlight.current) return;
        registrationInFlight.current = true;

        setRegistrationStatus('submitting');
        setRegistrationMessage('');

        try {
          // Capture UTM params from URL
          const urlParams = new URLSearchParams(window.location.search);
          const utmSource = urlParams.get('utm_source');
          const utmMedium = urlParams.get('utm_medium');
          const utmCampaign = urlParams.get('utm_campaign');

          const requestBody = {
            landing_page_id: currentPage.id,
            email: formData.email,
            first_name: formData.first_name || '',
            last_name: formData.last_name || '',
            phone: formData.phone || null,
            registration_data: formData,
            coupon_code: formData.coupon_code || null,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign
          };

          // Step 1: ask the server whether this registration requires payment.
          // The server is the source of truth for the amount (it re-runs
          // validate_event_registration including coupon math).
          const orderRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-razorpay-order`,
            {
              method: 'POST',
              headers: EDGE_FUNCTION_HEADERS,
              body: JSON.stringify({
                purpose: 'event_registration',
                metadata: requestBody,
              }),
            }
          );
          const orderResult = await orderRes.json();

          if (!orderRes.ok) {
            setRegistrationStatus('error');
            setRegistrationMessage(orderResult.error || 'Could not start registration. Please try again.');
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'registration-error', message: orderResult.error || 'Could not start registration.' },
              '*'
            );
            return;
          }

          // Free / 100%-coupon path — fall back to direct registration
          if (orderResult.skip_payment) {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-event-registration`,
              {
                method: 'POST',
                headers: EDGE_FUNCTION_HEADERS,
                body: JSON.stringify(requestBody),
              }
            );

            const result = await response.json();

            if (!response.ok) {
              setRegistrationStatus('error');
              setRegistrationMessage(result.error || result.message || 'Registration failed. Please try again.');
              return;
            }

            setRegistrationStatus('success');
            setRegistrationMessage(result.message);
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'registration-success', message: result.message },
              '*'
            );
            return;
          }

          // Paid path — open Razorpay checkout
          setRegistrationStatus('idle'); // hide overlay so the modal is visible
          await openRazorpayCheckout({
            key: orderResult.key_id,
            amount: orderResult.amount,
            currency: orderResult.currency,
            name: currentPage.association?.name || 'SMB Connect',
            description: currentPage.title,
            order_id: orderResult.razorpay_order_id,
            prefill: orderResult.prefill,
            theme: { color: '#1e3a5f' },
            handler: async (response) => {
              setRegistrationStatus('submitting');
              try {
                const verifyRes = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-razorpay-payment`,
                  {
                    method: 'POST',
                    headers: EDGE_FUNCTION_HEADERS,
                    body: JSON.stringify({
                      payment_id: orderResult.payment_id,
                      razorpay_order_id: response.razorpay_order_id,
                      razorpay_payment_id: response.razorpay_payment_id,
                      razorpay_signature: response.razorpay_signature,
                    }),
                  }
                );
                const verifyResult = await verifyRes.json();
                if (!verifyRes.ok || !verifyResult.success) {
                  setRegistrationStatus('error');
                  setRegistrationMessage(verifyResult.error || 'Payment verification failed. If you were charged, please contact support.');
                  iframeRef.current?.contentWindow?.postMessage(
                    { type: 'registration-error', message: verifyResult.error || 'Payment verification failed.' },
                    '*'
                  );
                  return;
                }
                setRegistrationStatus('success');
                setRegistrationMessage(verifyResult.message);
                iframeRef.current?.contentWindow?.postMessage(
                  { type: 'registration-success', message: verifyResult.message },
                  '*'
                );
              } catch (verifyErr) {
                console.error('Verify error:', verifyErr);
                setRegistrationStatus('error');
                setRegistrationMessage('Payment verification failed. If you were charged, please contact support.');
              }
            },
            modal: {
              ondismiss: () => {
                // User closed the modal without paying — webhook will mark failed/timeout.
                // Allow them to retry.
                registrationInFlight.current = false;
              },
            },
          });
        } catch (err) {
          setRegistrationStatus('error');
          const errorMsg = 'An error occurred during registration. Please try again.';
          setRegistrationMessage(errorMsg);
          // Notify the iframe about the error
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'registration-error', message: errorMsg },
            '*'
          );
        } finally {
          registrationInFlight.current = false;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Inject CSS and the form interception script into the HTML
  const getEnhancedHtml = (html: string, cssContent?: string | null, pages?: PageInfo[], registrationFee?: number | null, pageId?: string): string => {
    // No DOMPurify — content is rendered in a sandboxed iframe which provides isolation
    let sanitizedHtml = html;

    // Inject CSS if present
    if (cssContent) {
      const styleTag = `<style>${cssContent}</style>`;
      if (sanitizedHtml.includes('</head>')) {
        sanitizedHtml = sanitizedHtml.replace('</head>', styleTag + '</head>');
      } else if (sanitizedHtml.includes('<body>')) {
        sanitizedHtml = sanitizedHtml.replace('<body>', '<head>' + styleTag + '</head><body>');
      } else {
        sanitizedHtml = styleTag + sanitizedHtml;
      }
    }

    // Create navigation script for internal page links
    const pagesJson = JSON.stringify(pages || []);
    const baseSlug = slug || '';
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const fee = registrationFee || 0;
    const landingPageId = pageId || '';
    const formInterceptScript = `
      <style>
        /* Coupon section styles */
        #smb-coupon-section {
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 20px;
          margin: 20px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #smb-coupon-section .fee-display {
          margin-bottom: 16px;
        }
        #smb-coupon-section .fee-label {
          font-size: 13px;
          color: #64748b;
          margin-bottom: 4px;
        }
        #smb-coupon-section .fee-amount {
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
        }
        #smb-coupon-section .coupon-input-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        #smb-coupon-section .coupon-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 14px;
          text-transform: uppercase;
          outline: none;
          transition: border-color 0.2s;
        }
        #smb-coupon-section .coupon-input:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        #smb-coupon-section .apply-btn {
          padding: 10px 20px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        #smb-coupon-section .apply-btn:hover {
          background: #4f46e5;
        }
        #smb-coupon-section .apply-btn:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        #smb-coupon-section .coupon-message {
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        #smb-coupon-section .coupon-message.success {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }
        #smb-coupon-section .coupon-message.error {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        #smb-coupon-section .price-breakdown {
          background: white;
          border-radius: 8px;
          padding: 12px 16px;
          border: 1px solid #e2e8f0;
        }
        #smb-coupon-section .price-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 14px;
        }
        #smb-coupon-section .price-row.discount {
          color: #16a34a;
        }
        #smb-coupon-section .price-row.total {
          border-top: 2px solid #e2e8f0;
          margin-top: 8px;
          padding-top: 12px;
          font-weight: 700;
          font-size: 16px;
        }
        #smb-coupon-section .price-row.total.free {
          color: #16a34a;
        }
      </style>
      <script>
        (function() {
          var pages = ${pagesJson};
          var baseSlug = "${baseSlug}";
          var supabaseUrl = "${supabaseUrl}";
          var publishableKey = "${publishableKey}";
          var registrationFee = ${fee};
          var landingPageId = "${landingPageId}";
          
          var appliedCoupon = null;
          var currentDiscount = 0;
          var currentDiscountType = null;
          var currentDiscountValue = 0;
          
          // Handle internal navigation links
          document.addEventListener('click', function(e) {
            var link = e.target.closest('a');
            if (!link) return;
            
            var href = link.getAttribute('href');
            if (!href) return;
            
            // Check if it's an internal page link (starts with # followed by page slug)
            if (href.startsWith('#page:')) {
              e.preventDefault();
              var pageSlug = href.replace('#page:', '');
              var targetPage = pages.find(function(p) { return p.slug === pageSlug || (pageSlug === 'home' && p.is_default); });
              if (targetPage) {
                var newPath = targetPage.is_default ? '/event/' + baseSlug : '/event/' + baseSlug + '/' + targetPage.slug;
                window.parent.location.href = newPath;
              }
            }
          });

          // Inject coupon section into forms if registration fee exists
          function injectCouponSection() {
            if (registrationFee <= 0) return;
            
            var forms = document.querySelectorAll('form');
            forms.forEach(function(form) {
              // Check if already injected
              if (form.querySelector('#smb-coupon-section')) return;
              
              var submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
              if (!submitBtn) return;
              
              var couponSection = document.createElement('div');
              couponSection.id = 'smb-coupon-section';
              couponSection.innerHTML = 
                '<div class="fee-display">' +
                  '<div class="fee-label">Registration Fee</div>' +
                  '<div class="fee-amount" id="smb-display-fee">₹' + registrationFee.toLocaleString('en-IN') + '</div>' +
                '</div>' +
                '<div class="coupon-input-row">' +
                  '<input type="text" class="coupon-input" id="smb-coupon-input" placeholder="Enter coupon code" />' +
                  '<button type="button" class="apply-btn" id="smb-apply-coupon">Apply</button>' +
                '</div>' +
                '<div id="smb-coupon-message" style="display:none;"></div>' +
                '<div id="smb-price-breakdown" style="display:none;"></div>';
              
              submitBtn.parentNode.insertBefore(couponSection, submitBtn);
              
              // Add hidden input for coupon code
              var hiddenInput = document.createElement('input');
              hiddenInput.type = 'hidden';
              hiddenInput.name = 'coupon_code';
              hiddenInput.id = 'smb-coupon-code-hidden';
              form.appendChild(hiddenInput);
              
              // Bind apply button
              document.getElementById('smb-apply-coupon').addEventListener('click', validateCoupon);
              document.getElementById('smb-coupon-input').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  validateCoupon();
                }
              });
            });
          }
          
          function validateCoupon() {
            var input = document.getElementById('smb-coupon-input');
            var messageEl = document.getElementById('smb-coupon-message');
            var breakdownEl = document.getElementById('smb-price-breakdown');
            var applyBtn = document.getElementById('smb-apply-coupon');
            var hiddenInput = document.getElementById('smb-coupon-code-hidden');
            
            var code = input.value.trim();
            if (!code) {
              showMessage('Please enter a coupon code', 'error');
              return;
            }
            
            // Get email from form
            var emailInput = document.querySelector('input[name="email"], input[type="email"]');
            var email = emailInput ? emailInput.value.trim() : '';
            if (!email) {
              showMessage('Please enter your email first', 'error');
              return;
            }
            
            applyBtn.disabled = true;
            applyBtn.textContent = 'Validating...';
            
            fetch(supabaseUrl + '/rest/v1/rpc/validate_coupon', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': publishableKey },
              body: JSON.stringify({
                p_code: code,
                p_landing_page_id: landingPageId,
                p_email: email
              })
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              applyBtn.disabled = false;
              applyBtn.textContent = 'Apply';
              
              if (data.valid) {
                appliedCoupon = code;
                currentDiscountType = data.discount_type;
                currentDiscountValue = data.discount_value;
                
                // Calculate discount
                if (data.discount_type === 'percentage') {
                  currentDiscount = Math.round((registrationFee * data.discount_value) / 100);
                } else {
                  currentDiscount = data.discount_value;
                }
                currentDiscount = Math.min(currentDiscount, registrationFee);
                
                var finalAmount = registrationFee - currentDiscount;
                
                showMessage(data.message, 'success');
                hiddenInput.value = code;
                input.disabled = true;
                applyBtn.style.display = 'none';
                
                // Show price breakdown
                var breakdownHtml = 
                  '<div class="price-breakdown">' +
                    '<div class="price-row"><span>Original Price</span><span>₹' + registrationFee.toLocaleString('en-IN') + '</span></div>' +
                    '<div class="price-row discount"><span>Discount (' + (data.discount_type === 'percentage' ? data.discount_value + '%' : '₹' + data.discount_value) + ')</span><span>-₹' + currentDiscount.toLocaleString('en-IN') + '</span></div>' +
                    '<div class="price-row total' + (finalAmount === 0 ? ' free' : '') + '"><span>Total</span><span>' + (finalAmount === 0 ? 'FREE' : '₹' + finalAmount.toLocaleString('en-IN')) + '</span></div>' +
                  '</div>';
                breakdownEl.innerHTML = breakdownHtml;
                breakdownEl.style.display = 'block';
                
                // Update displayed fee
                document.getElementById('smb-display-fee').innerHTML = 
                  '<span style="text-decoration: line-through; color: #94a3b8; font-size: 18px;">₹' + registrationFee.toLocaleString('en-IN') + '</span> ' +
                  '<span style="color: #16a34a;">₹' + finalAmount.toLocaleString('en-IN') + '</span>';
              } else {
                showMessage(data.message || 'Invalid coupon code', 'error');
                hiddenInput.value = '';
              }
            })
            .catch(function(err) {
              console.error('Coupon validation error:', err);
              applyBtn.disabled = false;
              applyBtn.textContent = 'Apply';
              showMessage('Failed to validate coupon. Please try again.', 'error');
            });
          }
          
          function showMessage(msg, type) {
            var messageEl = document.getElementById('smb-coupon-message');
            messageEl.textContent = msg;
            messageEl.className = 'coupon-message ' + type;
            messageEl.style.display = 'block';
          }

          // Intercept all form submissions (capture phase to fire before custom handlers)
          document.addEventListener('submit', function(e) {
            e.preventDefault();
            
            var form = e.target;
            var formData = new FormData(form);
            var data = {};
            
            formData.forEach(function(value, key) {
              data[key] = value;
            });
            
            console.log('[SMB Registration] Raw form data:', JSON.stringify(data));
            
            // Normalize field names - try multiple common variations
            var email = data.email || data.Email || data.EMAIL || data.user_email || data.userEmail || data['e-mail'] || '';
            var firstName = data.first_name || data.firstName || data.FirstName || data.fname || data.given_name || '';
            var lastName = data.last_name || data.lastName || data.LastName || data.lname || data.surname || data.family_name || '';
            var phone = data.phone || data.Phone || data.mobile || data.Mobile || data.telephone || data.cell || '';
            
            // Handle combined "name" field
            if (!firstName && !lastName && data.name) {
              var nameParts = data.name.trim().split(/\\s+/);
              firstName = nameParts[0] || '';
              lastName = nameParts.slice(1).join(' ') || '';
            }
            
            // Validation
            if (!email) {
              console.error('[SMB Registration] No email found in form data');
              alert('Please enter your email address');
              return;
            }
            
            if (!firstName) {
              console.error('[SMB Registration] No first name found in form data');
              alert('Please enter your first name');
              return;
            }
            
            // Prepare normalized data
            var normalizedData = Object.assign({}, data, {
              email: email,
              first_name: firstName,
              last_name: lastName,
              phone: phone || null
            });
            
            console.log('[SMB Registration] Normalized data:', JSON.stringify(normalizedData));
            
            // Send to parent window
            window.parent.postMessage({
              type: 'event-registration',
              data: normalizedData
            }, '*');
          }, true); // capture phase — fires before any custom stopPropagation

          // Listen for registration result
          window.addEventListener('message', function(e) {
            if (e.data?.type === 'registration-success') {
              var successHtml = '<div style="padding: 24px; text-align: center; color: #16a34a; font-size: 18px;">' +
                '<svg style="width: 56px; height: 56px; margin: 0 auto 12px;" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' +
                '<p style="margin: 0; font-weight: 700; font-size: 20px;">Payment Successful!</p>' +
                '<p style="margin: 10px 0 0; font-size: 14px; color: #166534;">' + (e.data.message || 'Your registration is confirmed.') + '</p>' +
              '</div>';

              // Replace any forms with the success message
              var forms = document.querySelectorAll('form');
              forms.forEach(function(form) { form.innerHTML = successHtml; });

              // Also replace any payment-button-only sections (non-form pay flows)
              var paySections = document.querySelectorAll('#smb-payment-section, .smb-payment-section');
              paySections.forEach(function(sec) { sec.innerHTML = successHtml; });

              // If a #modal-pay-btn exists outside any form/pay-section, swap the button itself
              var loosePayBtn = document.getElementById('modal-pay-btn');
              if (loosePayBtn && !loosePayBtn.closest('form, #smb-payment-section, .smb-payment-section')) {
                var wrap = document.createElement('div');
                wrap.innerHTML = successHtml;
                loosePayBtn.replaceWith(wrap);
              }
            }
          });
          
          // Validate coupon entered in modal-style forms and update the displayed amount.
          // Watches #modal-coupon input. Updates #modal-amount (form value), and any of
          // #modal-fee-display / #modal-amount-display / #modal-final-amount (visual).
          // Feedback goes in #modal-coupon-message if present.
          function hookModalCoupon() {
            var couponInput = document.getElementById('modal-coupon');
            if (!couponInput || couponInput.__smbCouponHooked) return;
            couponInput.__smbCouponHooked = true;

            var applyBtn = document.getElementById('modal-apply-coupon')
              || document.getElementById('modal-coupon-apply')
              || document.getElementById('apply-coupon-btn');

            function showFeedback(msg, isError) {
              var msgEl = document.getElementById('modal-coupon-message');
              if (msgEl) {
                msgEl.textContent = msg;
                msgEl.style.color = isError ? '#dc2626' : '#16a34a';
                msgEl.style.display = msg ? 'block' : 'none';
              }
              if (couponInput && couponInput.style) {
                couponInput.style.borderColor = msg ? (isError ? '#dc2626' : '#16a34a') : '';
              }
            }

            function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }

            function updateAmountDisplay(originalFee, finalAmount) {
              // Hidden / form value
              var amountEl = document.getElementById('modal-amount');
              if (amountEl) {
                if (amountEl.tagName === 'INPUT' || amountEl.tagName === 'TEXTAREA') {
                  amountEl.value = String(finalAmount);
                } else {
                  amountEl.textContent = String(finalAmount);
                }
              }
              // Visual display elements (any/all of these can exist)
              var displayHtml = finalAmount === originalFee
                ? inr(originalFee)
                : '<span style="text-decoration:line-through;color:#94a3b8;">' + inr(originalFee) + '</span> ' +
                  '<span style="color:#16a34a;font-weight:700;">' + inr(finalAmount) + '</span>';
              ['modal-fee-display', 'modal-amount-display', 'modal-final-amount'].forEach(function(id) {
                var el = document.getElementById(id);
                if (!el) return;
                if (id === 'modal-final-amount') {
                  el.textContent = inr(finalAmount);
                } else {
                  el.innerHTML = displayHtml;
                }
              });
            }

            var validating = false;
            function doValidate() {
              if (validating) return;
              var code = (couponInput.value || '').trim().toUpperCase();
              if (!code) {
                updateAmountDisplay(registrationFee, registrationFee);
                showFeedback('', false);
                return;
              }
              var emailEl = document.getElementById('modal-email')
                || document.querySelector('input[name="email"], input[type="email"]');
              var email = emailEl && emailEl.value ? emailEl.value.trim() : '';
              if (!email) {
                showFeedback('Please enter your email first', true);
                return;
              }

              validating = true;
              if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.dataset.smbOrigText = applyBtn.textContent;
                applyBtn.textContent = 'Validating...';
              }

              fetch(supabaseUrl + '/rest/v1/rpc/validate_coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': publishableKey },
                body: JSON.stringify({
                  p_code: code,
                  p_landing_page_id: landingPageId,
                  p_email: email
                })
              })
              .then(function(res) { return res.json(); })
              .then(function(data) {
                if (data && data.valid) {
                  var discount = data.discount_type === 'percentage'
                    ? Math.round((registrationFee * Number(data.discount_value)) / 100)
                    : Number(data.discount_value);
                  discount = Math.min(discount, registrationFee);
                  var finalAmount = registrationFee - discount;
                  updateAmountDisplay(registrationFee, finalAmount);
                  var msg = 'Coupon applied — you save ' + inr(discount);
                  if (finalAmount === 0) msg = 'Coupon applied — registration is FREE';
                  showFeedback(msg, false);
                } else {
                  updateAmountDisplay(registrationFee, registrationFee);
                  showFeedback((data && data.message) || 'Invalid coupon code', true);
                }
              })
              .catch(function(err) {
                console.error('[SMB Coupon] validate error:', err);
                showFeedback('Could not validate coupon. Try again.', true);
              })
              .finally(function() {
                validating = false;
                if (applyBtn) {
                  applyBtn.disabled = false;
                  if (applyBtn.dataset.smbOrigText) applyBtn.textContent = applyBtn.dataset.smbOrigText;
                }
              });
            }

            if (applyBtn) {
              applyBtn.addEventListener('click', function(e) {
                e.preventDefault();
                doValidate();
              });
            }
            // Always also validate on blur / Enter key as a fallback
            couponInput.addEventListener('blur', doValidate);
            couponInput.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                e.preventDefault();
                doValidate();
              }
            });

            // Show the original fee on first hook so the modal isn't blank
            if (registrationFee > 0) updateAmountDisplay(registrationFee, registrationFee);
          }

          // Hook into custom "Pay & Register" buttons commonly used in landing pages
          function hookPayButton() {
            var payBtn = document.getElementById('modal-pay-btn');
            if (payBtn && !payBtn.__smbHooked) {
              payBtn.__smbHooked = true;
              console.log('[SMB Registration] Found modal-pay-btn, hooking into click handler');
              
              payBtn.addEventListener('click', function(e) {
                // Collect data from modal form fields
                var data = {
                  email: (document.getElementById('modal-email') || {}).value || '',
                  first_name: (document.getElementById('modal-firstname') || {}).value || '',
                  last_name: (document.getElementById('modal-lastname') || {}).value || '',
                  phone: (document.getElementById('modal-mobile') || {}).value || '',
                  designation: (document.getElementById('modal-designation') || {}).value || '',
                  organization: (document.getElementById('modal-organization') || {}).value || '',
                  city: (document.getElementById('modal-city') || {}).value || '',
                  category: (document.getElementById('modal-category') || {}).value || '',
                  amount: (document.getElementById('modal-amount') || {}).value || '',
                  coupon_code: (document.getElementById('modal-coupon') || {}).value || '',
                  message: (document.getElementById('modal-message') || {}).value || ''
                };
                
                // Collect sales channels if visible
                var salesChannels = [];
                document.querySelectorAll('input[name="sales_channels"]:checked').forEach(function(cb) {
                  salesChannels.push(cb.value);
                });
                if (salesChannels.length > 0) {
                  data.sales_channels = salesChannels.join(', ');
                }
                var otherInput = document.getElementById('channel-others-input');
                if (otherInput && otherInput.value) {
                  data.sales_channels_other = otherInput.value;
                }
                
                console.log('[SMB Registration] Modal pay button clicked, data:', JSON.stringify(data));
                
                // Validate required fields
                if (!data.email) {
                  console.error('[SMB Registration] No email in modal form');
                  return; // Let the original handler show error
                }
                if (!data.first_name) {
                  console.error('[SMB Registration] No first name in modal form');
                  return;
                }
                
                // Send to parent window for processing
                window.parent.postMessage({
                  type: 'event-registration',
                  data: data
                }, '*');
                
                console.log('[SMB Registration] Sent registration data to parent');
              }, true); // Use capture phase to run before other handlers
            }
          }
          
          // Inject coupon section and hook pay button when DOM is ready
          function initAll() {
            injectCouponSection();
            hookModalCoupon();
            hookPayButton();

            // Also observe for dynamically added modal elements (modal opens after page load)
            var observer = new MutationObserver(function(mutations) {
              hookModalCoupon();
              hookPayButton();
            });
            observer.observe(document.body, { childList: true, subtree: true });
          }
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initAll);
          } else {
            initAll();
          }
        })();
      </script>
    `;

    // SDK script tag — makes window.SMBConnect available inside iframe
    const sdkScript = `<script>
${`(function(){if(window.SMBConnect)return;var _s=null,_e=null;window.SMBConnect={register:function(d){if(!d||!d.email){console.error("[SMBConnect] email required");if(_e)_e("Email is required");return}if(!d.first_name){console.error("[SMBConnect] first_name required");if(_e)_e("First name is required");return}window.parent.postMessage({type:"event-registration",data:d},"*")},onSuccess:function(c){_s=c},onError:function(c){_e=c}};window.addEventListener("message",function(e){if(e.data&&e.data.type==="registration-success"&&_s)_s(e.data.message);if(e.data&&e.data.type==="registration-error"&&_e)_e(e.data.message)})})();`}
</script>`;

    // Insert script before closing body tag
    const allScripts = formInterceptScript + sdkScript;
    if (sanitizedHtml.includes('</body>')) {
      return sanitizedHtml.replace('</body>', allScripts + '</body>');
    } else {
      return sanitizedHtml + allScripts;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading event page...</p>
        </div>
      </div>
    );
  }

  if (error || !landingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'The event page you are looking for does not exist or has been deactivated.'}
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Go to Homepage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Status overlay for registration feedback */}
      {registrationStatus !== 'idle' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6 text-center">
            {registrationStatus === 'submitting' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-lg font-medium">Processing your registration...</p>
              </>
            )}
            {registrationStatus === 'success' && (
              <>
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium text-green-600 mb-2">Registration Successful!</p>
                <p className="text-muted-foreground">{registrationMessage}</p>
                <Button className="mt-4" onClick={() => setRegistrationStatus('idle')}>
                  Close
                </Button>
              </>
            )}
            {registrationStatus === 'error' && (
              <>
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
                <p className="text-lg font-medium text-destructive mb-2">Registration Failed</p>
                <p className="text-muted-foreground">{registrationMessage}</p>
                <Button className="mt-4" onClick={() => setRegistrationStatus('idle')}>
                  Try Again
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Render the landing page HTML in an iframe for isolation */}
      <iframe
        ref={iframeRef}
        srcDoc={getEnhancedHtml(landingPage.html_content, landingPage.css_content, landingPage.pages, landingPage.registration_fee, landingPage.id)}
        className="w-full min-h-screen border-0"
        sandbox="allow-scripts allow-forms allow-same-origin"
        title={landingPage.title}
      />
    </div>
  );
};

export default EventLandingPageView;
