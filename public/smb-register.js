/**
 * SMB Connect Registration SDK
 * Drop this script into your custom event landing page HTML to enable
 * registration through the SMB Connect platform.
 *
 * Usage:
 *   <script src="/smb-register.js"></script>
 *   <script>
 *     document.getElementById('my-form').addEventListener('submit', function(e) {
 *       e.preventDefault();
 *       var fd = new FormData(e.target);
 *       SMBConnect.register({
 *         email: fd.get('email'),
 *         first_name: fd.get('first_name'),
 *         last_name: fd.get('last_name'),
 *         phone: fd.get('phone') || ''
 *       });
 *     });
 *   </script>
 */
(function () {
  'use strict';

  // Prevent double-init
  if (window.SMBConnect) return;

  var _successCb = null;
  var _errorCb = null;

  window.SMBConnect = {
    /**
     * Send registration data to the platform.
     * @param {Object} data - { email, first_name, last_name, phone?, coupon_code?, ...extras }
     */
    register: function (data) {
      if (!data || !data.email) {
        console.error('[SMBConnect] email is required');
        if (_errorCb) _errorCb('Email is required');
        return;
      }
      if (!data.first_name) {
        console.error('[SMBConnect] first_name is required');
        if (_errorCb) _errorCb('First name is required');
        return;
      }

      window.parent.postMessage(
        { type: 'event-registration', data: data },
        '*'
      );
    },

    /**
     * Register a callback for successful registration.
     * @param {Function} cb - function(message)
     */
    onSuccess: function (cb) {
      _successCb = cb;
    },

    /**
     * Register a callback for failed registration.
     * @param {Function} cb - function(message)
     */
    onError: function (cb) {
      _errorCb = cb;
    }
  };

  // Listen for results from the parent frame
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'registration-success') {
      if (_successCb) _successCb(e.data.message);
    }
    if (e.data && e.data.type === 'registration-error') {
      if (_errorCb) _errorCb(e.data.message);
    }
  });
})();
