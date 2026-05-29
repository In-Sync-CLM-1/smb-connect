import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import {
  Search,
  Users,
  Building2,
  Handshake,
  Megaphone,
  CalendarCheck,
  BarChart3,
  MessageCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  TrendingUp,
  Globe,
  Send,
  UserPlus,
  Mail,
  Phone,
  Rss,
  Shield,
  FileSpreadsheet,
  Ticket,
  LayoutDashboard,
} from "lucide-react";
import logo from "@/assets/smb-connect-logo.jpg";

/* ── data ─────────────────────────────────────────────── */

const benefits = [
  {
    icon: Search,
    title: "Discover Other Associations",
    description:
      "Find and connect with like-minded associations on the platform — collaborate on events, share audiences, and co-grow your ecosystems together.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-500",
  },
  {
    icon: Handshake,
    title: "Help Members Find Each Other",
    description:
      "Your members can browse, search, and connect with each other LinkedIn-style — building relationships that your association makes possible.",
    gradient: "from-emerald-500/20 to-green-500/20",
    iconColor: "text-emerald-500",
  },
  {
    icon: UserPlus,
    title: "Attract New Members",
    description:
      "Event landing pages with registration, automated onboarding, and a public-facing profile that draws new members to your association organically.",
    gradient: "from-violet-500/20 to-purple-500/20",
    iconColor: "text-violet-500",
  },
  {
    icon: Building2,
    title: "Invite Companies to Join",
    description:
      "Bring companies into your ecosystem with bulk invitations and CSV onboarding — grow your directory effortlessly and give members more to connect with.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-500",
  },
  {
    icon: Rss,
    title: "Keep Your Community Engaged",
    description:
      "A live feed where members post updates, share wins, and interact — likes, comments, shares, and reposts keep the community buzzing.",
    gradient: "from-rose-500/20 to-pink-500/20",
    iconColor: "text-rose-500",
  },
  {
    icon: Megaphone,
    title: "Reach Members Instantly",
    description:
      "Bulk email campaigns and WhatsApp broadcasts to reach your entire membership in one click — with real-time delivery and engagement tracking.",
    gradient: "from-teal-500/20 to-emerald-500/20",
    iconColor: "text-teal-500",
  },
  {
    icon: CalendarCheck,
    title: "Run Events That Convert",
    description:
      "Launch event pages with registration forms, coupon codes, and UTM tracking — turn one-time attendees into long-term, active members.",
    gradient: "from-indigo-500/20 to-blue-500/20",
    iconColor: "text-indigo-500",
  },
  {
    icon: BarChart3,
    title: "Know What's Working",
    description:
      "Real-time analytics on member growth, onboarding completion, engagement trends, and top-performing companies — so you double down on what works.",
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    iconColor: "text-fuchsia-500",
  },
];

const platformFeatures = [
  { icon: Users, label: "Member Directory & Search" },
  { icon: Handshake, label: "LinkedIn-style Connections" },
  { icon: MessageCircle, label: "1:1 Direct Messaging" },
  { icon: Rss, label: "Community Feed with Posts, Likes & Shares" },
  { icon: Mail, label: "Bulk Email Campaigns with Analytics" },
  { icon: Phone, label: "WhatsApp Broadcasts" },
  { icon: Ticket, label: "Event Landing Pages with Coupons" },
  { icon: FileSpreadsheet, label: "CSV Bulk Upload (Members & Companies)" },
  { icon: Building2, label: "Company Invitations & Onboarding" },
  { icon: Shield, label: "Association Profile with Key Functionaries" },
  { icon: LayoutDashboard, label: "Real-time Analytics Dashboard" },
  { icon: Globe, label: "Role-based Access Control" },
];

const stats = [
  { value: 50, suffix: "+", label: "Associations" },
  { value: 10, suffix: "K+", label: "Members Connected" },
  { value: 2, suffix: "K+", label: "Companies Onboarded" },
  { value: 200, suffix: "+", label: "Events Hosted" },
];

const steps = [
  {
    icon: Globe,
    title: "Register Your Association",
    description:
      "Set up your profile, upload your logo, and add your leadership team in minutes.",
  },
  {
    icon: Users,
    title: "Build Your Network",
    description:
      "Invite companies and members via bulk upload, or let them discover and join you.",
  },
  {
    icon: Send,
    title: "Engage & Collaborate",
    description:
      "Post updates, message members, run events, and broadcast to your community.",
  },
  {
    icon: TrendingUp,
    title: "Grow Organically",
    description:
      "Members connect, companies join, other associations find you — your network grows itself.",
  },
];

const partnerLogos = [
  { name: "SMB Connect", initials: "SC" },
  { name: "D2C Insider", initials: "D2" },
  { name: "Founders Club", initials: "FC" },
  { name: "BizNet India", initials: "BN" },
  { name: "StartUp Circle", initials: "SU" },
  { name: "Trade Alliance", initials: "TA" },
  { name: "Growth Forum", initials: "GF" },
  { name: "Industry Connect", initials: "IC" },
];

/* ── animation helpers ────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

function AnimatedSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Animated counter ─────────────────────────────────── */

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, value]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

/* ── Floating particles for hero ──────────────────────── */

function FloatingParticles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/10"
          style={{
            width: 8 + i * 12,
            height: 8 + i * 12,
            left: `${15 + i * 14}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, 15 * (i % 2 === 0 ? 1 : -1), 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4 + i * 0.7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ── Main component ───────────────────────────────────── */

export default function AssociationLanding() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 border-b border-border/50 bg-background/60 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logo} alt="SMBConnect" className="h-9 object-contain rounded-lg" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              SMBConnect
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <a href="#benefits">Benefits</a>
            </Button>
            <Button variant="ghost" className="hidden sm:inline-flex" asChild>
              <a href="#how-it-works">How It Works</a>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/auth/login">Sign In</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-primary/25">
              <Link to="/auth/register">
                Get Started <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────── */}
      <section ref={heroRef} className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/4 h-[600px] w-[600px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute -bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-primary/6 blur-[100px]" />
          <div className="absolute top-1/3 right-1/3 h-[300px] w-[300px] rounded-full bg-emerald-500/5 blur-[100px]" />
        </div>

        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage:
              "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <FloatingParticles />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative mx-auto max-w-6xl px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28 lg:pt-36"
        >
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2 text-sm font-medium text-primary backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              India's Association Growth Platform
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Your Members Are
              <br />
              Looking for Each Other{" "}
              <span className="relative">
                <span className="bg-gradient-to-r from-primary via-emerald-500 to-primary bg-clip-text text-transparent">
                  — Help Them Connect
                </span>
                <motion.span
                  className="absolute -bottom-2 left-0 h-1 rounded-full bg-gradient-to-r from-primary via-emerald-500 to-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                />
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              Give your association a digital home where members discover each
              other, companies collaborate, and your community grows organically.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45 }}
              className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button
                size="lg"
                className="group relative overflow-hidden text-base px-8 shadow-xl shadow-primary/25 transition-shadow hover:shadow-2xl hover:shadow-primary/30"
                asChild
              >
                <Link to="/auth/register">
                  Register Your Association
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="group text-base px-8 backdrop-blur-sm"
                asChild
              >
                <a href="#benefits">
                  <Clock className="mr-2 h-4 w-4" />
                  See How It Works
                </a>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              {[
                "Free to get started",
                "Setup in 5 minutes",
                "No credit card required",
              ].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Logo Marquee ───────────────────────────── */}
      <section className="relative border-t border-border/50 bg-muted/30 py-14 sm:py-16">
        <AnimatedSection className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.p
            variants={fadeUp}
            className="mb-10 text-center text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Trusted by associations across India
          </motion.p>
        </AnimatedSection>

        <div className="space-y-5 overflow-hidden">
          {[0, 1].map((row) => {
            const rowLogos =
              row === 0
                ? partnerLogos.slice(0, Math.ceil(partnerLogos.length / 2))
                : partnerLogos.slice(Math.ceil(partnerLogos.length / 2));
            const doubled = [...rowLogos, ...rowLogos];
            return (
              <div key={row} className="relative flex overflow-hidden">
                <div
                  className={`flex shrink-0 items-center gap-8 ${
                    row === 0 ? "animate-marquee" : "animate-marquee-reverse"
                  }`}
                >
                  {doubled.map((item, i) => (
                    <div
                      key={`${row}-${i}`}
                      className="flex h-14 w-40 shrink-0 items-center justify-center gap-3 rounded-xl border border-border/40 bg-background/80 px-4 py-2 opacity-50 transition-all duration-300 hover:border-border hover:opacity-100 hover:shadow-md"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                        {item.initials}
                      </div>
                      <span className="text-sm font-medium text-muted-foreground truncate">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────── */}
      <section id="benefits" className="relative overflow-hidden border-t border-border/50">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/[0.03] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Why Associations Choose SMBConnect
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Grow your community,
              <br />
              <span className="text-primary">not your workload</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              Everything your association needs to attract members, foster
              connections, and build a thriving business ecosystem.
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <motion.div
                key={b.title}
                variants={fadeUp}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 p-7 backdrop-blur-sm transition-colors hover:border-primary/30"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${b.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                />
                <div className="relative">
                  <div
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${b.gradient} ring-1 ring-border/50`}
                  >
                    <b.icon className={`h-6 w-6 ${b.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {b.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {b.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Features Strip ─────────────────────────── */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <AnimatedSection className="mx-auto max-w-2xl text-center mb-14">
            <motion.p
              variants={fadeUp}
              className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Everything you need to run a modern association — built in
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
            {platformFeatures.map((f) => (
              <motion.div
                key={f.label}
                variants={fadeUp}
                className="flex items-center gap-3"
              >
                <f.icon className="h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-sm font-medium text-foreground">
                  {f.label}
                </span>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────── */}
      <section
        id="how-it-works"
        className="relative border-t border-border/50"
      >
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center">
            <motion.div
              variants={fadeUp}
              className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
            >
              <Clock className="h-3.5 w-3.5" />
              How It Works
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Up and running in{" "}
              <span className="text-primary">minutes</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 text-lg text-muted-foreground"
            >
              Four simple steps to a thriving digital association
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="relative mt-20 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute top-14 left-[12%] right-[12%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block" />

            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={fadeUp}
                className="relative text-center"
              >
                <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/20" />
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg shadow-primary/25">
                    {i + 1}
                  </div>
                  <step.icon className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mx-auto mt-2 max-w-[240px] text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────── */}
      <section className="relative border-t border-border/50 bg-muted/30">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[600px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection className="mx-auto max-w-2xl text-center mb-16">
            <motion.h2
              variants={fadeUp}
              className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              Powering associations{" "}
              <span className="text-primary">at scale</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-lg text-muted-foreground"
            >
              Associations across industries trust SMBConnect to grow and engage
              their communities
            </motion.p>
          </AnimatedSection>

          <AnimatedSection className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {stats.map((s) => (
              <motion.div
                key={s.label}
                variants={fadeUp}
                className="group rounded-2xl border border-border/50 bg-card/50 p-8 text-center backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
              >
                <p className="text-4xl font-extrabold text-primary sm:text-5xl">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  {s.label}
                </p>
              </motion.div>
            ))}
          </AnimatedSection>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="border-t border-border/50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <AnimatedSection>
            <motion.div
              variants={fadeUp}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-emerald-600 px-6 py-20 text-center sm:px-16"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-black/10 blur-3xl" />
                <div
                  className="absolute inset-0 opacity-10"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
                    backgroundSize: "40px 40px",
                  }}
                />
              </div>

              <div className="relative">
                <h2 className="text-3xl font-bold text-primary-foreground sm:text-5xl">
                  Your next 100 members are already here
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-primary-foreground/80">
                  Register your association in minutes and give your community a
                  digital home where connections happen naturally.
                </p>
                <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="group text-base px-8 shadow-xl"
                    asChild
                  >
                    <Link to="/auth/register">
                      Register Your Association
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
                  {[
                    "Free to get started",
                    "No credit card required",
                    "Dedicated support",
                  ].map((t) => (
                    <span key={t} className="flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <img src={logo} alt="SMBConnect" className="h-7 object-contain rounded-md" />
              <span className="font-semibold text-foreground">SMBConnect</span>
            </div>
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} SMBConnect. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
