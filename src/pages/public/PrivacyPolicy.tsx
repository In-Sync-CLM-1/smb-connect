import { PolicyLayout } from "@/components/PolicyLayout";

export default function PrivacyPolicy() {
  return (
    <PolicyLayout title="Privacy Policy" lastUpdated="April 21, 2026">
      <p>
        SMB Connect ("we", "us", "our") values your privacy. This Privacy Policy explains what
        information we collect through the Platform at smbconnect.in, how we use it, with
        whom we share it, and the choices available to you. By using the Platform you consent
        to the practices described here.
      </p>

      <h2>1. Information We Collect</h2>
      <h3>a. Information you provide</h3>
      <ul>
        <li>Account details: name, email address, mobile number, password.</li>
        <li>Profile details: job title, company, associations, photo, bio.</li>
        <li>Business details: company name, registration, industry, contact details.</li>
        <li>Payment details: handled by our PCI-DSS compliant payment partners — we do not store full card numbers.</li>
        <li>Content: posts, messages, event registrations, uploaded documents.</li>
        <li>Communications with support.</li>
      </ul>
      <h3>b. Information collected automatically</h3>
      <ul>
        <li>Log data: IP address, browser type, device type, pages viewed, referring URL.</li>
        <li>Cookies and similar technologies used for session management, analytics, and preferences.</li>
        <li>Usage data such as feature interactions and approximate geolocation inferred from IP.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To provide, maintain, and improve the Platform.</li>
        <li>To authenticate users and secure accounts.</li>
        <li>To process payments, subscriptions, and event registrations.</li>
        <li>To enable discovery, networking, and communications between members.</li>
        <li>To send service announcements, invitations, and relevant updates.</li>
        <li>To analyze usage and improve features.</li>
        <li>To comply with legal obligations and enforce our Terms.</li>
      </ul>

      <h2>3. Sharing of Information</h2>
      <p>We share information only in the following circumstances:</p>
      <ul>
        <li>
          <strong>Within the Platform:</strong> Profile information, posts, and directory
          listings are visible to other members and administrators as determined by your
          privacy settings and the nature of the content.
        </li>
        <li>
          <strong>Service providers:</strong> Vetted third parties who process data on our
          behalf, including hosting, payment processing, email and WhatsApp delivery,
          analytics, and customer support — under contractual confidentiality obligations.
        </li>
        <li>
          <strong>Legal compliance:</strong> When required by law, court order, or to protect
          the rights, property, or safety of SMB Connect, our users, or others.
        </li>
        <li>
          <strong>Business transfers:</strong> In connection with a merger, acquisition, or
          sale of assets, subject to equivalent confidentiality and privacy protections.
        </li>
      </ul>
      <p>We do not sell your personal data to third parties.</p>

      <h2>4. Cookies</h2>
      <p>
        We use cookies and similar technologies to keep you signed in, remember preferences,
        understand usage, and improve the Platform. You can control cookies through your
        browser settings. Disabling essential cookies may affect Platform functionality.
      </p>

      <h2>5. Data Security</h2>
      <p>
        We apply reasonable administrative, technical, and physical safeguards — including
        TLS in transit, access controls, and encryption at rest for sensitive fields — to
        protect your data. However, no method of transmission or storage is completely
        secure, and we cannot guarantee absolute security.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain personal data for as long as your account is active or as needed to provide
        services, comply with legal obligations, resolve disputes, and enforce our agreements.
        You may request deletion of your account, subject to legal retention requirements.
      </p>

      <h2>7. Your Rights</h2>
      <p>Subject to applicable law, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Request correction of inaccurate information.</li>
        <li>Request deletion or restriction of processing.</li>
        <li>Withdraw consent where processing is based on consent.</li>
        <li>Object to processing in certain circumstances.</li>
        <li>Lodge a complaint with the relevant data protection authority.</li>
      </ul>
      <p>
        To exercise these rights, email{" "}
        <a href="mailto:support@smbconnect.in">support@smbconnect.in</a> from your registered
        email address.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        The Platform is not intended for individuals under 18. We do not knowingly collect
        personal data from children. If you believe we have inadvertently collected such
        information, please contact us to have it removed.
      </p>

      <h2>9. International Transfers</h2>
      <p>
        Data may be processed and stored in data centres located outside your country of
        residence. Where required by law, we put appropriate safeguards in place for such
        transfers.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be posted
        on this page with an updated effective date, and — where appropriate — notified to
        you via email or through the Platform.
      </p>

      <h2>11. Contact Us</h2>
      <p>
        Questions or requests regarding this Privacy Policy? Write to{" "}
        <a href="mailto:support@smbconnect.in">support@smbconnect.in</a>.
      </p>
    </PolicyLayout>
  );
}
