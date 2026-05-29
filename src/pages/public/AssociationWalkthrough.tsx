import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Users,
  Building2,
  LayoutDashboard,
  Radio,
  Mail,
  BarChart3,
  UserPlus,
  CalendarDays,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  CheckCircle,
  MessageSquare,
  Search,
  Bell,
  Send,
  Link2,
  Upload,
  Handshake,
  Network,
  Star,
  ChevronRight,
  CheckCheck,
} from "lucide-react";

/* ── Scenes ────────────────────────────────────────────── */

const SCENES = [
  { id: "intro",      label: "Intro",      duration: 5000 },
  { id: "dashboard",  label: "Dashboard",  duration: 12000 },
  { id: "companies",  label: "Companies",  duration: 11000 },
  { id: "network",    label: "Network",    duration: 11000 },
  { id: "feed",       label: "Feed",       duration: 12000 },
  { id: "messages",   label: "Messages",   duration: 10000 },
  { id: "events",     label: "Events",     duration: 11000 },
  { id: "email",      label: "Email",      duration: 11000 },
  { id: "analytics",  label: "Analytics",  duration: 10000 },
  { id: "outro",      label: "Get Started",duration: 6000 },
] as const;

const TOTAL = SCENES.reduce((s, sc) => s + sc.duration, 0);
type SceneId = (typeof SCENES)[number]["id"];

/* ── Animation helpers ─────────────────────────────────── */

const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit:    { opacity: 0 },
  transition: { duration: 0.6 },
};

const slideUp   = (delay = 0) => ({ initial: { opacity: 0, y: 28 },  animate: { opacity: 1, y: 0,  transition: { duration: 0.5, delay } } });
const slideLeft = (delay = 0) => ({ initial: { opacity: 0, x: 36 },  animate: { opacity: 1, x: 0,  transition: { duration: 0.5, delay } } });
const slideRight= (delay = 0) => ({ initial: { opacity: 0, x: -36 }, animate: { opacity: 1, x: 0,  transition: { duration: 0.5, delay } } });

/* ── Typewriter ─────────────────────────────────────────── */

function TypewriterText({ text, delay = 0, speed = 28 }: { text: string; delay?: number; speed?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= text.length) { setShown(text.slice(0, i)); i++; }
        else clearInterval(interval);
      }, speed);
      return () => clearInterval(interval);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [text, delay, speed]);
  return (
    <>
      {shown}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity }}
        className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
      />
    </>
  );
}

/* ── Animated counter ──────────────────────────────────── */

function AnimatedValue({ value, delay }: { value: string; delay: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(false);
    const t = setTimeout(() => setShow(true), delay * 1000);
    return () => clearTimeout(t);
  }, [delay, value]);
  return <p className="mt-1 text-2xl font-bold text-foreground">{show ? value : "—"}</p>;
}

/* ── Sidebar nav ─────────────────────────────────────────── */

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Building2,       label: "Companies" },
  { icon: Users,           label: "Members" },
  { icon: Radio,           label: "Feed" },
  { icon: UserPlus,        label: "Invitations" },
  { icon: CalendarDays,    label: "Events" },
  { icon: Mail,            label: "Bulk Email" },
  { icon: BarChart3,       label: "Analytics" },
];

function MockSidebar({ active }: { active: string }) {
  return (
    <motion.div
      {...slideRight()}
      className="flex w-52 shrink-0 flex-col border-r border-border/60 bg-card"
    >
      <div className="flex h-14 items-center gap-2 border-b border-border/40 px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Network className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-sm font-bold tracking-tight text-foreground">SMBConnect</span>
      </div>
      <div className="border-b border-border/40 px-3 py-2">
        <div className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary truncate">
          CREDAI Pune Chapter
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {navItems.map((item) => {
          const isActive = item.label === active;
          return (
            <div
              key={item.label}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-border/40 px-4 py-3">
        <p className="truncate text-[10px] text-muted-foreground">admin@credaipune.org</p>
      </div>
    </motion.div>
  );
}

/* ── KPI card ─────────────────────────────────────────────── */

function KpiCard({ label, value, change, color, icon: Icon, delay }: {
  label: string; value: string; change: string; color: string; icon: any; delay: number;
}) {
  return (
    <motion.div {...slideUp(delay)} className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-4">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${color}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <AnimatedValue value={value} delay={delay + 0.3} />
        </div>
        <div className="rounded-lg bg-muted/50 p-1.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { delay: delay + 0.8 } }}
        className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600"
      >
        <TrendingUp className="h-3 w-3" /> {change}
      </motion.div>
    </motion.div>
  );
}

/* ── Onboarding bar ───────────────────────────────────────── */

function OnboardingBar({ label, pct, color, delay }: { label: string; pct: number; color: string; delay: number }) {
  return (
    <motion.div {...slideUp(delay)} className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: delay + 0.3, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </motion.div>
  );
}

/* ── Member card ─────────────────────────────────────────── */

function MemberCard({ name, company, role, avatar, connected, delay }: {
  name: string; company: string; role: string; avatar: string; connected?: boolean; delay: number;
}) {
  return (
    <motion.div
      {...slideUp(delay)}
      className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground truncate">{role} · {company}</p>
      </div>
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1, transition: { delay: delay + 0.5 } }}
        className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-semibold ${
          connected
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {connected ? <><CheckCheck className="inline h-3 w-3 mr-1" />Connected</> : "Connect"}
      </motion.button>
    </motion.div>
  );
}

/* ── Post card ───────────────────────────────────────────── */

function PostCard({ author, role, content, likes, comments, delay }: {
  author: string; role: string; content: string; likes: number; comments: number; delay: number;
}) {
  return (
    <motion.div {...slideUp(delay)} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {author[0]}
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{author}</p>
          <p className="text-[10px] text-muted-foreground">{role}</p>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-foreground/80">{content}</p>
      <div className="flex items-center gap-4 pt-1 border-t border-border/40">
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Star className="h-3 w-3" /> {likes} likes
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MessageSquare className="h-3 w-3" /> {comments} comments
        </span>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCENES
══════════════════════════════════════════════════════════ */

/* ── Intro ─────────────────────────────────────────────── */

function SceneIntro() {
  return (
    <motion.div {...fade} className="flex h-full flex-col items-center justify-center bg-background relative overflow-hidden px-8">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      {/* Logo + brand */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="relative mb-6 flex items-center gap-3"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-xl shadow-primary/30">
          <Network className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-xl font-bold tracking-tight text-foreground">SMBConnect</span>
      </motion.div>

      {/* CORE HEADLINE — the big message */}
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.6 }}
        className="relative text-center text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl"
      >
        Your Members Are{" "}
        <span className="relative inline-block">
          <span className="relative z-10 text-primary">Looking for Each Other.</span>
          <motion.span
            className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full bg-primary/30"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
            style={{ transformOrigin: "left" }}
          />
        </span>
        <br />
        <span className="text-foreground">Help Them Connect.</span>
      </motion.h1>

      {/* Supporting line */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.5 }}
        className="relative mt-5 text-center text-base text-muted-foreground max-w-md leading-relaxed"
      >
        Give your association a digital home — where companies discover each other,
        members collaborate, and your community grows on its own.
      </motion.p>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="relative mt-8 flex items-center gap-8"
      >
        {[
          { value: "50+",    label: "Associations" },
          { value: "10K+",   label: "Members" },
          { value: "2,000+", label: "Companies" },
        ].map((s, i) => (
          <div key={i} className="text-center">
            <p className="text-2xl font-extrabold text-primary">{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        className="relative mt-10 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/8 px-5 py-2"
      >
        <span className="text-xs font-semibold text-primary">See how it works</span>
        <motion.span
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-primary text-xs"
        >→</motion.span>
      </motion.div>
    </motion.div>
  );
}

/* ── Dashboard ─────────────────────────────────────────── */

function SceneDashboard() {
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Dashboard" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <motion.div {...slideUp(0)}>
          <h2 className="text-base font-bold text-foreground">Welcome, Association Admin!</h2>
          <p className="text-[11px] text-muted-foreground">CREDAI Pune Chapter · Your community at a glance</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard label="Total Members"   value="1,248" change="+38 this month" color="from-primary to-emerald-500"    icon={Users}       delay={0.1} />
          <KpiCard label="Member Companies" value="186"  change="+12 this month" color="from-blue-500 to-sky-400"       icon={Building2}   delay={0.2} />
          <KpiCard label="Active Today"    value="342"   change="↑ 18% vs last week" color="from-violet-500 to-purple-400" icon={TrendingUp} delay={0.3} />
          <KpiCard label="Pending Invites" value="24"    change="7 accepted today"   color="from-amber-500 to-orange-400" icon={UserPlus}  delay={0.4} />
        </div>

        <motion.div {...slideUp(0.6)} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Member Onboarding Progress</p>
          <OnboardingBar label="Profile Complete"     pct={84} color="bg-primary"        delay={0.7} />
          <OnboardingBar label="Connected to 3+"      pct={61} color="bg-blue-500"       delay={0.85} />
          <OnboardingBar label="First Post Published" pct={47} color="bg-violet-500"     delay={1.0} />
          <OnboardingBar label="Joined Company Feed"  pct={72} color="bg-emerald-500"    delay={1.15} />
        </motion.div>

        <motion.div {...slideUp(1.3)} className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Star className="h-4 w-4 text-primary" />
            <p className="text-xs font-bold text-primary">Quick Actions</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Invite Companies", "Bulk Upload", "Send Email Blast", "View Analytics"].map((a, i) => (
              <motion.span
                key={a}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: 1.5 + i * 0.1 } }}
                className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold text-primary cursor-pointer"
              >
                {a}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Companies ─────────────────────────────────────────── */

function SceneCompanies() {
  const companies = [
    { name: "Rajendra Builders", city: "Pune", members: 14, status: "Active",  verified: true },
    { name: "Harmony Infra",     city: "Pune", members: 8,  status: "Active",  verified: true },
    { name: "SkyView Developers",city: "PCMC", members: 22, status: "Active",  verified: false },
    { name: "Greenfield Realty", city: "Pune", members: 6,  status: "Pending", verified: false },
  ];
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Companies" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <motion.div {...slideUp(0)}>
            <h2 className="text-base font-bold text-foreground">Member Companies</h2>
            <p className="text-[11px] text-muted-foreground">186 companies in your association</p>
          </motion.div>
          <motion.div {...slideLeft(0.2)} className="flex gap-2">
            <span className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
              <Search className="h-3 w-3" /> Search companies…
            </span>
            <span className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground cursor-pointer">
              <UserPlus className="h-3 w-3" /> Invite
            </span>
          </motion.div>
        </div>

        <motion.div {...slideUp(0.3)} className="grid gap-3">
          {companies.map((c, i) => (
            <motion.div
              key={c.name}
              {...slideUp(0.3 + i * 0.1)}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-xs font-bold text-blue-600">
                {c.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground">{c.name}</p>
                  {c.verified && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                </div>
                <p className="text-[10px] text-muted-foreground">{c.city} · {c.members} members</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                c.status === "Active" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
              }`}>
                {c.status}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div {...slideUp(0.9)} className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center space-y-2">
          <p className="text-xs font-semibold text-primary">Invite all your member companies at once</p>
          <div className="flex items-center justify-center gap-3">
            <span className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-[10px] font-medium text-primary">
              <Link2 className="h-3 w-3" /> Share Invite Link
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-[10px] font-medium text-primary">
              <Upload className="h-3 w-3" /> Bulk CSV Upload
            </span>
            <span className="flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-[10px] font-medium text-primary">
              <Mail className="h-3 w-3" /> Email Invitation
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Network ───────────────────────────────────────────── */

function SceneNetwork() {
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Members" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <motion.div {...slideUp(0)}>
            <h2 className="text-base font-bold text-foreground">Member Network</h2>
            <p className="text-[11px] text-muted-foreground">Your members discovering and connecting with each other</p>
          </motion.div>
          <motion.div {...slideLeft(0.2)} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-[10px] text-muted-foreground">
            <Search className="h-3 w-3" /> Search by name, company…
          </motion.div>
        </div>

        <div className="grid gap-2.5">
          <MemberCard name="Anil Sharma"    company="Rajendra Builders" role="CEO"            avatar="AS" connected delay={0.2} />
          <MemberCard name="Priya Mehta"    company="Harmony Infra"     role="Director"       avatar="PM"          delay={0.35} />
          <MemberCard name="Ravi Joshi"     company="SkyView Developers" role="MD"            avatar="RJ"          delay={0.5} />
          <MemberCard name="Kavita Desai"   company="Greenfield Realty" role="Sales Head"     avatar="KD" connected delay={0.65} />
          <MemberCard name="Suresh Patil"   company="Apex Constructions" role="Founder"       avatar="SP"          delay={0.8} />
        </div>

        <motion.div {...slideUp(1.1)} className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-3">Filter & Discover</p>
          <div className="flex flex-wrap gap-2">
            {["Pune", "PCMC", "Real Estate", "Construction", "Architects", "Finance"].map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: 1.2 + i * 0.08 } }}
                className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-[10px] text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
              >
                {tag}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Feed ──────────────────────────────────────────────── */

function SceneFeed() {
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Feed" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <motion.div {...slideUp(0)}>
          <h2 className="text-base font-bold text-foreground">Association Feed</h2>
          <p className="text-[11px] text-muted-foreground">Stay connected — updates, announcements, discussions</p>
        </motion.div>

        <motion.div {...slideUp(0.1)} className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
          <p className="text-[10px] text-primary font-medium mb-1.5">Share an update with your members…</p>
          <div className="flex gap-2">
            {["📢 Announcement", "🗓 Event", "💡 Tip"].map((p, i) => (
              <span key={i} className="rounded-lg border border-primary/20 px-2.5 py-1 text-[10px] text-primary cursor-pointer">
                {p}
              </span>
            ))}
          </div>
        </motion.div>

        <PostCard
          author="CREDAI Pune"
          role="Association · Pinned"
          content="📢 Annual General Meeting scheduled for May 10th at Hotel Pune Central. All member companies are requested to confirm attendance. Register now via the Events tab."
          likes={48} comments={12} delay={0.3}
        />
        <PostCard
          author="Anil Sharma"
          role="CEO · Rajendra Builders"
          content="Excited to announce our new residential project in Baner! Looking forward to connecting with fellow CREDAI members for potential collaborations. #RealEstate #Pune"
          likes={31} comments={8} delay={0.55}
        />
        <PostCard
          author="Priya Mehta"
          role="Director · Harmony Infra"
          content="Great networking session at last week's chapter meet! Met 3 potential partners. This is exactly why SMBConnect is a game-changer for our community. 🤝"
          likes={27} comments={5} delay={0.8}
        />
      </div>
    </motion.div>
  );
}

/* ── Messages ──────────────────────────────────────────── */

function SceneMessages() {
  const messages = [
    { from: "Ravi Joshi",   text: "Hi Anil, saw your post about the Baner project. We'd love to collaborate!", time: "10:32 AM", mine: false },
    { from: "Anil Sharma",  text: "Hi Ravi! Yes, we're looking for structural consultants. Can we schedule a call?", time: "10:35 AM", mine: true  },
    { from: "Ravi Joshi",   text: "Absolutely! How about Friday 3 PM?", time: "10:36 AM", mine: false },
    { from: "Anil Sharma",  text: "Friday works. I'll send a calendar invite. Looking forward to it! 🙌", time: "10:38 AM", mine: true  },
  ];
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Members" />
      {/* Conversations list */}
      <div className="w-44 shrink-0 border-r border-border/60 bg-card/50 overflow-y-auto">
        <div className="p-3 border-b border-border/40">
          <p className="text-xs font-semibold text-foreground">Messages</p>
        </div>
        {["Ravi Joshi", "Priya Mehta", "Kavita Desai", "Suresh Patil"].map((name, i) => (
          <motion.div
            key={name}
            {...slideUp(i * 0.1)}
            className={`flex items-center gap-2 p-3 border-b border-border/30 cursor-pointer ${i === 0 ? "bg-primary/5" : ""}`}
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-foreground truncate">{name}</p>
              <p className="text-[9px] text-muted-foreground truncate">
                {i === 0 ? "Friday works. I'll send…" : "Hey, quick question…"}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      {/* Chat */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-2.5">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">R</div>
          <div>
            <p className="text-xs font-semibold text-foreground">Ravi Joshi</p>
            <p className="text-[9px] text-emerald-500">Online</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <motion.div key={i} {...slideUp(0.2 + i * 0.2)} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-[10px] leading-relaxed ${
                m.mine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card border border-border/60 text-foreground rounded-tl-sm"
              }`}>
                {m.text}
                <p className={`mt-1 text-[9px] ${m.mine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{m.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <motion.div {...slideUp(1.2)} className="border-t border-border/60 bg-card p-3 flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
            Type a message…
          </div>
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center cursor-pointer">
            <Send className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Events ────────────────────────────────────────────── */

function SceneEvents() {
  const events = [
    { title: "Annual General Meeting",   date: "May 10", type: "In-Person", registered: 124 },
    { title: "Real Estate Expo 2026",    date: "May 22", type: "Hybrid",    registered: 88  },
    { title: "RERA Compliance Workshop", date: "Jun 4",  type: "Online",    registered: 201 },
    { title: "Networking Sundowner",     date: "Jun 18", type: "In-Person", registered: 67  },
  ];
  const typeColor: Record<string, string> = {
    "In-Person": "bg-blue-500/10 text-blue-600",
    "Hybrid":    "bg-violet-500/10 text-violet-600",
    "Online":    "bg-emerald-500/10 text-emerald-600",
  };
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Events" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <motion.div {...slideUp(0)}>
            <h2 className="text-base font-bold text-foreground">Event Calendar</h2>
            <p className="text-[11px] text-muted-foreground">Manage events, publish landing pages, track registrations</p>
          </motion.div>
          <motion.span {...slideLeft(0.2)} className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-semibold text-primary-foreground cursor-pointer">
            + Create Event
          </motion.span>
        </div>

        <div className="grid gap-3">
          {events.map((e, i) => (
            <motion.div key={e.title} {...slideUp(0.2 + i * 0.15)} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
                <span className="text-[9px] font-bold mt-0.5">{e.date}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{e.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${typeColor[e.type]}`}>{e.type}</span>
                  <span className="text-[10px] text-muted-foreground">{e.registered} registered</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          ))}
        </div>

        <motion.div {...slideUp(1.0)} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-primary">Public Event Landing Pages</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Each event gets a branded registration page with coupon codes, UTM tracking, and real-time analytics. Share it anywhere — no login required.
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium mt-1">
            <Link2 className="h-3 w-3" /> smbconnect.in/event/agm-2026
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Email ──────────────────────────────────────────────── */

function SceneEmail() {
  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Bulk Email" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <motion.div {...slideUp(0)}>
          <h2 className="text-base font-bold text-foreground">Bulk Email Campaigns</h2>
          <p className="text-[11px] text-muted-foreground">Reach all your members and companies in one send</p>
        </motion.div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Emails Sent",     value: "8,240", color: "from-primary to-emerald-500",    icon: Mail },
            { label: "Open Rate",       value: "42%",   color: "from-blue-500 to-sky-400",        icon: Bell },
            { label: "Click Rate",      value: "18%",   color: "from-violet-500 to-purple-400",   icon: TrendingUp },
          ].map((k, i) => (
            <KpiCard key={k.label} label={k.label} value={k.value} change="vs last campaign" color={k.color} icon={k.icon} delay={0.1 + i * 0.1} />
          ))}
        </div>

        <motion.div {...slideUp(0.5)} className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="border-b border-border/40 bg-muted/30 px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Recent Campaigns</p>
            <span className="rounded-lg bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground cursor-pointer">+ New Campaign</span>
          </div>
          {[
            { name: "AGM Reminder",         sent: 1248, open: "44%", date: "Apr 15" },
            { name: "RERA Workshop Invite",  sent: 1248, open: "38%", date: "Apr 8"  },
            { name: "Monthly Newsletter",    sent: 1248, open: "51%", date: "Apr 1"  },
          ].map((c, i) => (
            <motion.div key={c.name} {...slideUp(0.6 + i * 0.12)} className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{c.name}</p>
                <p className="text-[10px] text-muted-foreground">{c.sent} recipients · {c.date}</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600">{c.open} open</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ── Analytics ──────────────────────────────────────────── */

function SceneAnalytics() {
  const months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
  const data   = [340, 480, 620, 780, 970, 1248];
  const max    = 1300;

  return (
    <motion.div {...fade} className="flex h-full overflow-hidden bg-background">
      <MockSidebar active="Analytics" />
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <motion.div {...slideUp(0)}>
          <h2 className="text-base font-bold text-foreground">Association Analytics</h2>
          <p className="text-[11px] text-muted-foreground">Track growth, engagement, and community health</p>
        </motion.div>

        <motion.div {...slideUp(0.2)} className="rounded-xl border border-border/60 bg-card p-4">
          <p className="text-xs font-semibold text-foreground mb-4">Member Growth (last 6 months)</p>
          <div className="flex items-end gap-3" style={{ height: 120 }}>
            {data.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <motion.div
                  className="w-full rounded-t-md bg-gradient-to-t from-primary to-emerald-400"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d / max) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + i * 0.1, ease: "easeOut" }}
                />
                <span className="text-[9px] text-muted-foreground">{months[i]}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <motion.div {...slideUp(0.8)} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground">Top Companies by Members</p>
            {[
              { name: "SkyView Developers", count: 22, pct: 100 },
              { name: "Rajendra Builders",  count: 14, pct: 64  },
              { name: "Harmony Infra",      count: 8,  pct: 36  },
            ].map((c, i) => (
              <OnboardingBar key={c.name} label={c.name} pct={c.pct} color="bg-blue-500" delay={0.9 + i * 0.1} />
            ))}
          </motion.div>
          <motion.div {...slideUp(0.85)} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-foreground mb-3">Engagement Highlights</p>
            {[
              { label: "Avg connections/member", value: "6.4" },
              { label: "Posts this month",       value: "248" },
              { label: "Messages exchanged",     value: "1.2K" },
              { label: "Events attended",        value: "3.1 avg" },
            ].map((s, i) => (
              <motion.div key={s.label} {...slideUp(1.0 + i * 0.08)} className="flex justify-between text-[10px]">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-bold text-foreground">{s.value}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Outro ──────────────────────────────────────────────── */

function SceneOutro() {
  return (
    <motion.div {...fade} className="flex h-full flex-col items-center justify-center bg-background relative overflow-hidden px-8">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/15 blur-[140px]" />
        <div className="absolute bottom-1/4 right-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-[100px]" />
      </div>

      {/* Urgency badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative mb-6 flex items-center gap-2 rounded-full bg-primary px-4 py-1.5"
      >
        <motion.span
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="h-2 w-2 rounded-full bg-primary-foreground"
        />
        <span className="text-xs font-bold text-primary-foreground uppercase tracking-wider">
          Your community is waiting
        </span>
      </motion.div>

      {/* Big CTA headline */}
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        className="relative text-center text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl"
      >
        Don't Let Your Members{" "}
        <span className="text-primary">Network Elsewhere.</span>
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="relative mt-4 text-center text-base text-muted-foreground max-w-sm leading-relaxed"
      >
        Associations that register today get their members connected, engaged,
        and growing — in days, not months.
      </motion.p>

      {/* 4-step promise */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.5 }}
        className="relative mt-7 flex items-center gap-2 text-[11px] text-muted-foreground"
      >
        {[
          { icon: Building2, text: "Register" },
          { icon: UserPlus,  text: "Invite Companies" },
          { icon: Users,     text: "Members Connect" },
          { icon: TrendingUp,text: "Community Grows" },
        ].map((s, i) => (
          <div key={s.text} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
            <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-3 py-2">
              <s.icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-semibold text-foreground whitespace-nowrap">{s.text}</span>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Primary CTA button — big and obvious */}
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 1.2, duration: 0.5, type: "spring" }}
        className="relative mt-8 flex flex-col items-center gap-3"
      >
        <Link to="/auth/register">
          <Button size="lg" className="gap-2.5 px-8 py-5 text-base font-bold shadow-2xl shadow-primary/30">
            Register Your Association — It's Free
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <Link to="/auth/login">
          <p className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Already have an account? Sign in →
          </p>
        </Link>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCENE REGISTRY
══════════════════════════════════════════════════════════ */

const sceneComponents: Record<SceneId, () => JSX.Element> = {
  intro:     SceneIntro,
  dashboard: SceneDashboard,
  companies: SceneCompanies,
  network:   SceneNetwork,
  feed:      SceneFeed,
  messages:  SceneMessages,
  events:    SceneEvents,
  email:     SceneEmail,
  analytics: SceneAnalytics,
  outro:     SceneOutro,
};

/* ══════════════════════════════════════════════════════════
   PLAYER SHELL
══════════════════════════════════════════════════════════ */

export default function AssociationWalkthrough() {
  const [sceneIdx, setSceneIdx]   = useState(0);
  const [elapsed,  setElapsed]    = useState(0);
  const [playing,  setPlaying]    = useState(true);

  const currentScene = SCENES[sceneIdx];

  const goTo = useCallback((idx: number) => {
    setSceneIdx(idx);
    setElapsed(0);
  }, []);

  const restart = useCallback(() => { goTo(0); setPlaying(true); }, [goTo]);

  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setElapsed((e) => {
        const next = e + 100;
        if (next >= currentScene.duration) {
          if (sceneIdx < SCENES.length - 1) {
            setSceneIdx((i) => i + 1);
            return 0;
          } else {
            setPlaying(false);
            return currentScene.duration;
          }
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing, currentScene.duration, sceneIdx]);

  /* Global elapsed for the top progress bar */
  const sceneStartMs = SCENES.slice(0, sceneIdx).reduce((s, sc) => s + sc.duration, 0);
  const globalElapsed = sceneStartMs + elapsed;
  const globalPct = (globalElapsed / TOTAL) * 100;

  const SceneComp = sceneComponents[currentScene.id];

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* ── Global progress bar ── */}
      <div className="h-1 w-full bg-muted/40 shrink-0">
        <motion.div
          className="h-full bg-primary"
          style={{ width: `${globalPct}%` }}
          transition={{ ease: "linear" }}
        />
      </div>

      {/* ── Scene tabs ── */}
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border/60 bg-card px-3 py-1.5 scrollbar-none">
        {SCENES.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => { goTo(i); setPlaying(true); }}
            className={`relative shrink-0 rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${
              i === sceneIdx ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {sc.label}
            {i === sceneIdx && (
              <motion.div
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                layoutId="scene-indicator"
              />
            )}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 pl-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={restart}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── Scene ── */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={currentScene.id} className="absolute inset-0" {...fade}>
            <SceneComp />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Scene progress bar ── */}
      <div className="h-0.5 w-full bg-muted/40 shrink-0">
        <motion.div
          key={sceneIdx}
          className="h-full bg-primary/40"
          initial={{ width: "0%" }}
          animate={{ width: playing ? "100%" : `${(elapsed / currentScene.duration) * 100}%` }}
          transition={playing ? { duration: currentScene.duration / 1000, ease: "linear" } : { duration: 0 }}
        />
      </div>
    </div>
  );
}
