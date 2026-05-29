import { ReactNode } from "react";
import { Link } from "react-router-dom";
import logo from "@/assets/smb-connect-logo.jpg";

interface PolicyLayoutProps {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}

const POLICY_LINKS = [
  { to: "/terms", label: "Terms & Conditions" },
  { to: "/refund-policy", label: "Cancellation & Refund Policy" },
  { to: "/privacy-policy", label: "Privacy Policy" },
  { to: "/shipping-policy", label: "Shipping & Delivery Policy" },
];

export function PolicyLayout({ title, lastUpdated, children }: PolicyLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SMB Connect" className="h-8 w-8 rounded" />
            <span className="text-base font-semibold">SMB Connect</span>
          </Link>
          <Link
            to="/auth/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Last updated: {lastUpdated}
        </p>
        <article className="prose prose-sm max-w-none space-y-5 text-sm leading-6 text-foreground [&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
          {children}
        </article>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {POLICY_LINKS.map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-foreground hover:underline">
                {link.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-center">
            © {new Date().getFullYear()} SMB Connect. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export const PolicyFooterLinks = () => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
    {POLICY_LINKS.map((link, i) => (
      <span key={link.to} className="flex items-center gap-x-3">
        <Link to={link.to} className="hover:text-foreground hover:underline">
          {link.label}
        </Link>
        {i < POLICY_LINKS.length - 1 && <span className="opacity-40">·</span>}
      </span>
    ))}
  </div>
);
