import { PolicyLayout } from "@/components/PolicyLayout";

export default function RefundPolicy() {
  return (
    <PolicyLayout
      title="Cancellation & Refund Policy"
      lastUpdated="April 21, 2026"
    >
      <p>
        This Cancellation &amp; Refund Policy describes how cancellations and refunds are
        handled for paid subscriptions, event registrations, and other paid services offered
        on SMB Connect ("the Platform").
      </p>

      <h2>1. Subscription Cancellations</h2>
      <ul>
        <li>
          You may cancel your subscription at any time from your account settings. Cancellation
          takes effect at the end of your current billing cycle.
        </li>
        <li>
          You will continue to have access to paid features until the end of the billing cycle
          for which payment has already been made.
        </li>
        <li>
          We do not prorate or refund unused portions of a monthly or annual billing cycle,
          except as expressly set out below.
        </li>
      </ul>

      <h2>2. Refund Eligibility</h2>
      <p>Refunds may be considered only in the following cases:</p>
      <ul>
        <li>
          <strong>Duplicate payment:</strong> You were charged twice for the same subscription
          or transaction due to a technical error.
        </li>
        <li>
          <strong>Service unavailability:</strong> The paid feature was materially unavailable
          for an extended period due to an issue on our end and we were unable to resolve it
          within a reasonable time.
        </li>
        <li>
          <strong>Billing error:</strong> An incorrect amount was charged, in which case the
          excess amount will be refunded.
        </li>
      </ul>

      <h2>3. Non-Refundable Items</h2>
      <ul>
        <li>Partial months or partial billing periods of a subscription already consumed.</li>
        <li>Add-on services, one-time fees, or setup fees already delivered.</li>
        <li>Event registration fees once the event has occurred or is within 48 hours of start.</li>
        <li>Subscription renewals not cancelled prior to the renewal date.</li>
      </ul>

      <h2>4. Event Registration Refunds</h2>
      <p>
        For paid events hosted or promoted through SMB Connect, the refund window (if any) is
        set by the event organizer and displayed on the respective event landing page. Where
        no specific window is stated, the following defaults apply:
      </p>
      <ul>
        <li>More than 7 days before the event: full refund, less payment gateway charges.</li>
        <li>Between 48 hours and 7 days before the event: 50% refund.</li>
        <li>Less than 48 hours before the event, or after the event: no refund.</li>
      </ul>

      <h2>5. How to Request a Refund</h2>
      <p>
        To request a refund, email <a href="mailto:support@smbconnect.in">support@smbconnect.in</a>{" "}
        from the email address registered on your account with:
      </p>
      <ul>
        <li>Your account email and registered name.</li>
        <li>The transaction ID or order reference.</li>
        <li>A brief description of the reason for the refund request.</li>
      </ul>

      <h2>6. Processing Time</h2>
      <p>
        Approved refunds are processed within <strong>7–10 business days</strong> to the
        original payment method. Depending on your bank or card issuer, it may take an
        additional 3–5 business days for the amount to reflect in your account. Payment
        gateway charges, where applicable, may be deducted from the refund amount.
      </p>

      <h2>7. Chargebacks &amp; Disputes</h2>
      <p>
        We encourage you to reach out to us before initiating a chargeback with your bank.
        Most issues can be resolved faster by contacting our support team directly.
      </p>

      <h2>8. Contact Us</h2>
      <p>
        For any questions about cancellations or refunds, write to{" "}
        <a href="mailto:support@smbconnect.in">support@smbconnect.in</a>.
      </p>
    </PolicyLayout>
  );
}
