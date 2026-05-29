import { PolicyLayout } from "@/components/PolicyLayout";

export default function ShippingPolicy() {
  return (
    <PolicyLayout
      title="Shipping & Delivery Policy"
      lastUpdated="April 21, 2026"
    >
      <p>
        SMB Connect is a digital Software-as-a-Service (SaaS) platform. This Shipping &amp;
        Delivery Policy describes how and when access to our services is delivered after a
        successful purchase.
      </p>

      <h2>1. Nature of Services</h2>
      <p>
        All products and services offered through smbconnect.in — including subscriptions,
        premium features, event registrations, and directory access — are delivered
        electronically. <strong>No physical goods are shipped.</strong>
      </p>

      <h2>2. Delivery Method</h2>
      <ul>
        <li>
          <strong>Subscriptions and premium features:</strong> Access is enabled on your
          account immediately after successful payment confirmation from our payment gateway.
        </li>
        <li>
          <strong>Event registrations:</strong> A confirmation email containing event
          details and, where applicable, a joining link or ticket, is sent to your registered
          email address.
        </li>
        <li>
          <strong>Invoices and receipts:</strong> Emailed to your registered email address
          shortly after payment.
        </li>
      </ul>

      <h2>3. Delivery Timelines</h2>
      <ul>
        <li>
          <strong>Standard activation:</strong> Instant — typically within a few minutes of
          a successful transaction.
        </li>
        <li>
          <strong>Delayed activation:</strong> In rare cases (e.g., payment verification
          delays, bank or gateway downtime), activation may take up to <strong>24 hours</strong>.
        </li>
        <li>
          <strong>Confirmation email:</strong> Sent within a few minutes of payment. If you
          do not receive it, please check your spam or promotions folder.
        </li>
      </ul>

      <h2>4. Non-Receipt of Access or Confirmation</h2>
      <p>If you have completed a payment but have not received access or a confirmation:</p>
      <ul>
        <li>Refresh your account or sign out and sign back in.</li>
        <li>Check your spam/junk folder for the confirmation email.</li>
        <li>
          If the issue persists beyond 24 hours, email{" "}
          <a href="mailto:support@smbconnect.in">support@smbconnect.in</a> with your
          transaction ID and the registered email address.
        </li>
      </ul>

      <h2>5. No Physical Shipping</h2>
      <p>
        SMB Connect does not sell or dispatch any physical products. As such, there are no
        shipping charges, courier timelines, or delivery tracking associated with our
        services.
      </p>

      <h2>6. Contact Us</h2>
      <p>
        For any delivery-related queries, please contact{" "}
        <a href="mailto:support@smbconnect.in">support@smbconnect.in</a>.
      </p>
    </PolicyLayout>
  );
}
