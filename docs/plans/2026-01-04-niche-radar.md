# Niche Radar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a trend detection tool that monitors Reddit, HackerNews, Google Trends, and Wikipedia to find YouTube content opportunities before they become saturated.

**Architecture:** Next.js 14 App Router frontend on Vercel, Supabase PostgreSQL database, Python workers on Railway running every 6 hours. Beautiful dark-mode UI with shadcn/ui components and Framer Motion animations.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Supabase, Python 3.11, praw, pytrends, Recharts

---

## Phase 1: Foundation & Project Setup

### Task 1.1: Initialize Next.js Project

**Files:**
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

**Step 1: Create Next.js project with all options**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

**Step 2: Verify project runs**

Run: `npm run dev`
Expected: Server starts at http://localhost:3000

**Step 3: Commit**

```bash
git init
git add .
git commit -m "chore: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

### Task 1.2: Install and Configure shadcn/ui

**Files:**
- Modify: `tailwind.config.ts`
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`

**Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Select options:
- Style: Default
- Base color: Slate
- CSS variables: Yes

**Step 2: Install core UI components**

```bash
npx shadcn@latest add button card dropdown-menu input select badge table tabs skeleton
```

**Step 3: Verify component imports work**

Create test in `src/app/page.tsx`:
```tsx
import { Button } from "@/components/ui/button"
export default function Home() {
  return <Button>Test</Button>
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "chore: add shadcn/ui with core components"
```

---

### Task 1.3: Configure Dark Mode Theme

**Files:**
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/mode-toggle.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Install next-themes**

```bash
npm install next-themes
```

**Step 2: Create ThemeProvider component**

```tsx
// src/components/theme-provider.tsx
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Step 3: Create ModeToggle component**

```tsx
// src/components/mode-toggle.tsx
"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

**Step 4: Update root layout**

```tsx
// src/app/layout.tsx
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Niche Radar",
  description: "Find trending topics before YouTube saturation",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Step 5: Verify dark mode works**

Run: `npm run dev`
Expected: App loads in dark mode by default

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add dark mode with next-themes"
```

---

### Task 1.4: Install Framer Motion for Animations

**Files:**
- Modify: `package.json`

**Step 1: Install framer-motion**

```bash
npm install framer-motion
```

**Step 2: Verify installation**

Run: `npm list framer-motion`
Expected: Shows framer-motion version

**Step 3: Commit**

```bash
git add .
git commit -m "chore: add framer-motion for animations"
```

---

### Task 1.5: Set Up Supabase Client

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/types.ts`

**Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

**Step 2: Create environment files**

```bash
# .env.example
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

**Step 3: Create browser client**

```tsx
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create server client**

```tsx
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignore
          }
        },
      },
    }
  )
}
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Supabase client configuration"
```

---

### Task 1.6: Create Supabase Project and Run Schema

**Step 1: Create new Supabase project**

- Go to Supabase dashboard
- Click "New project"
- Name: `niche-radar`
- Region: Choose closest region
- Generate strong password

**Step 2: Copy credentials to .env.local**

From Supabase Settings > API:
- Copy Project URL to `NEXT_PUBLIC_SUPABASE_URL`
- Copy anon/public key to `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy service_role key to `SUPABASE_SERVICE_KEY`

**Step 3: Run database schema**

Go to SQL Editor in Supabase and run the complete schema from PRD section 4.1 (docs/PRD.md lines 221-541)

**Step 4: Verify tables created**

Check Table Editor - should see:
- topics
- topic_sources
- topic_signals
- youtube_supply
- opportunities
- scan_log
- seed_keywords
- subreddit_config

**Step 5: Commit env example**

```bash
git add .env.example
git commit -m "docs: add environment variables example"
```

---

### Task 1.7: Generate TypeScript Types from Supabase

**Files:**
- Modify: `src/lib/supabase/types.ts`

**Step 1: Install Supabase CLI**

```bash
npm install -D supabase
```

**Step 2: Login to Supabase CLI**

```bash
npx supabase login
```

**Step 3: Generate types**

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/supabase/types.ts
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add Supabase TypeScript types"
```

---

## Phase 2: Core UI Components & Layout

### Task 2.1: Create App Shell Layout

**Files:**
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create Header component with logo and navigation**

```tsx
// src/components/layout/header.tsx
"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Radar, Search, Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.5 }}
          >
            <Radar className="h-6 w-6 text-emerald-500" />
          </motion.div>
          <span className="font-bold text-xl">Niche Radar</span>
        </Link>

        <nav className="flex items-center space-x-6 text-sm font-medium flex-1">
          <Link href="/" className="transition-colors hover:text-foreground/80">
            Dashboard
          </Link>
          <Link href="/analyse" className="transition-colors hover:text-foreground/80">
            Analyse
          </Link>
          <Link href="/discover" className="transition-colors hover:text-foreground/80">
            Discover
          </Link>
          <Link href="/watchlist" className="transition-colors hover:text-foreground/80">
            Watchlist
          </Link>
        </nav>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
          <ModeToggle />
        </div>
      </div>
    </motion.header>
  )
}
```

**Step 2: Create AppShell wrapper**

```tsx
// src/components/layout/app-shell.tsx
import { Header } from "./header"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container max-w-screen-2xl py-6">
        {children}
      </main>
    </div>
  )
}
```

**Step 3: Update layout to use AppShell**

**Step 4: Verify layout displays**

Run: `npm run dev`
Expected: Header with logo and navigation visible

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add app shell layout with header"
```

---

### Task 2.2: Create Animated Page Transitions

**Files:**
- Create: `src/components/motion/page-transition.tsx`
- Create: `src/components/motion/fade-in.tsx`
- Create: `src/components/motion/stagger-children.tsx`

**Step 1: Create PageTransition wrapper**

```tsx
// src/components/motion/page-transition.tsx
"use client"

import { motion } from "framer-motion"

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  )
}
```

**Step 2: Create FadeIn component**

```tsx
// src/components/motion/fade-in.tsx
"use client"

import { motion } from "framer-motion"

interface FadeInProps {
  children: React.ReactNode
  delay?: number
  direction?: "up" | "down" | "left" | "right"
}

export function FadeIn({ children, delay = 0, direction = "up" }: FadeInProps) {
  const directions = {
    up: { y: 40 },
    down: { y: -40 },
    left: { x: 40 },
    right: { x: -40 },
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  )
}
```

**Step 3: Create StaggerChildren for lists**

```tsx
// src/components/motion/stagger-children.tsx
"use client"

import { motion } from "framer-motion"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
}

export function StaggerChildren({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children }: { children: React.ReactNode }) {
  return <motion.div variants={item}>{children}</motion.div>
}
```

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add animation components with framer-motion"
```

---

### Task 2.3: Create OpportunityCard Component

**Files:**
- Create: `src/components/opportunities/opportunity-card.tsx`
- Create: `src/components/opportunities/gap-meter.tsx`
- Create: `src/components/opportunities/phase-badge.tsx`
- Create: `src/components/opportunities/source-icons.tsx`

**Step 1: Create GapMeter visualization**

```tsx
// src/components/opportunities/gap-meter.tsx
"use client"

import { motion } from "framer-motion"

interface GapMeterProps {
  score: number
}

export function GapMeter({ score }: GapMeterProps) {
  const getColor = () => {
    if (score >= 70) return "bg-emerald-500"
    if (score >= 50) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getColor()}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  )
}
```

**Step 2: Create PhaseBadge component**

```tsx
// src/components/opportunities/phase-badge.tsx
import { Badge } from "@/components/ui/badge"

const phaseColors = {
  innovation: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  emergence: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  growth: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  maturity: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  saturated: "bg-red-500/20 text-red-400 border-red-500/30",
}

interface PhaseBadgeProps {
  phase: keyof typeof phaseColors
}

export function PhaseBadge({ phase }: PhaseBadgeProps) {
  return (
    <Badge variant="outline" className={phaseColors[phase]}>
      {phase.charAt(0).toUpperCase() + phase.slice(1)}
    </Badge>
  )
}
```

**Step 3: Create SourceIcons component**

```tsx
// src/components/opportunities/source-icons.tsx
import { MessageSquare, Flame, TrendingUp, BookOpen } from "lucide-react"

const sourceIcons = {
  reddit: { icon: MessageSquare, color: "text-orange-500" },
  hackernews: { icon: Flame, color: "text-orange-400" },
  google_trends: { icon: TrendingUp, color: "text-blue-500" },
  wikipedia: { icon: BookOpen, color: "text-gray-400" },
}

interface SourceIconsProps {
  sources: string[]
}

export function SourceIcons({ sources }: SourceIconsProps) {
  return (
    <div className="flex items-center gap-1">
      {sources.map((source) => {
        const config = sourceIcons[source as keyof typeof sourceIcons]
        if (!config) return null
        const Icon = config.icon
        return (
          <Icon key={source} className={`h-4 w-4 ${config.color}`} />
        )
      })}
    </div>
  )
}
```

**Step 4: Create main OpportunityCard**

```tsx
// src/components/opportunities/opportunity-card.tsx
"use client"

import { motion } from "framer-motion"
import { Star, ArrowRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GapMeter } from "./gap-meter"
import { PhaseBadge } from "./phase-badge"
import { SourceIcons } from "./source-icons"

interface OpportunityCardProps {
  id: string
  keyword: string
  category: string
  phase: "innovation" | "emergence" | "growth" | "maturity" | "saturated"
  confidence: "high" | "medium" | "low"
  gapScore: number
  sources: string[]
  isWatched: boolean
  firstSeenAt: string
  onToggleWatch: (id: string) => void
}

export function OpportunityCard({
  id,
  keyword,
  category,
  phase,
  confidence,
  gapScore,
  sources,
  isWatched,
  firstSeenAt,
  onToggleWatch,
}: OpportunityCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur hover:border-emerald-500/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg truncate">{keyword}</h3>
                <PhaseBadge phase={phase} />
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span>{category}</span>
                <span>|</span>
                <span>{confidence} confidence</span>
                <span>|</span>
                <SourceIcons sources={sources} />
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Gap Score</span>
                  <GapMeter score={gapScore} />
                </div>
                <div className="text-xs text-muted-foreground">
                  First seen: {new Date(firstSeenAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleWatch(id)}
                className={isWatched ? "text-yellow-500" : "text-muted-foreground"}
              >
                <Star className={`h-4 w-4 ${isWatched ? "fill-current" : ""}`} />
              </Button>
              <Link href={`/opportunity/${id}`}>
                <Button variant="ghost" size="icon">
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>

        {/* Gradient border effect on hover */}
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="absolute inset-[-1px] rounded-lg bg-gradient-to-r from-emerald-500/20 to-blue-500/20" />
        </div>
      </Card>
    </motion.div>
  )
}
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add opportunity card components with animations"
```

---

### Task 2.4: Create Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/app/api/opportunities/route.ts`
- Create: `src/components/opportunities/filter-bar.tsx`
- Create: `src/components/opportunities/opportunities-list.tsx`

**Step 1: Create FilterBar component**

```tsx
// src/components/opportunities/filter-bar.tsx
"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface FilterBarProps {
  onFilterChange: (filters: FilterState) => void
}

interface FilterState {
  category: string
  phase: string
  confidence: string
  minGap: number
  search: string
}

export function FilterBar({ onFilterChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-card/50 rounded-lg border border-border/50">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search opportunities..."
          className="pl-10"
          onChange={(e) => onFilterChange({ search: e.target.value } as FilterState)}
        />
      </div>

      <Select onValueChange={(value) => onFilterChange({ category: value } as FilterState)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="tech">Tech</SelectItem>
          <SelectItem value="finance">Finance</SelectItem>
          <SelectItem value="health">Health</SelectItem>
          <SelectItem value="business">Business</SelectItem>
          <SelectItem value="diy">DIY</SelectItem>
          <SelectItem value="gaming">Gaming</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange({ phase: value } as FilterState)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Phase" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Phases</SelectItem>
          <SelectItem value="innovation">Innovation</SelectItem>
          <SelectItem value="emergence">Emergence</SelectItem>
          <SelectItem value="growth">Growth</SelectItem>
          <SelectItem value="maturity">Maturity</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={(value) => onFilterChange({ confidence: value } as FilterState)}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Confidence" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Confidence</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
```

**Step 2: Create OpportunitiesList component**

```tsx
// src/components/opportunities/opportunities-list.tsx
"use client"

import { motion } from "framer-motion"
import { OpportunityCard } from "./opportunity-card"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

interface Opportunity {
  id: string
  keyword: string
  category: string
  phase: "innovation" | "emergence" | "growth" | "maturity" | "saturated"
  confidence: "high" | "medium" | "low"
  gap_score: number
  sources: string[]
  is_watched: boolean
  first_seen_at: string
}

interface OpportunitiesListProps {
  opportunities: Opportunity[]
  onToggleWatch: (id: string) => void
}

export function OpportunitiesList({ opportunities, onToggleWatch }: OpportunitiesListProps) {
  if (opportunities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-16 text-center"
      >
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-semibold mb-2">No opportunities found</h3>
        <p className="text-muted-foreground">Try adjusting your filters or check back later.</p>
      </motion.div>
    )
  }

  return (
    <StaggerChildren>
      <div className="grid gap-4">
        {opportunities.map((opp) => (
          <StaggerItem key={opp.id}>
            <OpportunityCard
              id={opp.id}
              keyword={opp.keyword}
              category={opp.category}
              phase={opp.phase}
              confidence={opp.confidence}
              gapScore={opp.gap_score}
              sources={opp.sources}
              isWatched={opp.is_watched}
              firstSeenAt={opp.first_seen_at}
              onToggleWatch={onToggleWatch}
            />
          </StaggerItem>
        ))}
      </div>
    </StaggerChildren>
  )
}
```

**Step 3: Create Dashboard page**

```tsx
// src/app/page.tsx
import { Suspense } from "react"
import { PageTransition } from "@/components/motion/page-transition"
import { FadeIn } from "@/components/motion/fade-in"
import { FilterBar } from "@/components/opportunities/filter-bar"
import { OpportunitiesList } from "@/components/opportunities/opportunities-list"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Radar Feed</h1>
              <p className="text-muted-foreground">
                Trending topics with low YouTube competition
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              Last scan: 2 hours ago
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <FilterBar onFilterChange={() => {}} />
        </FadeIn>

        <FadeIn delay={0.2}>
          <Suspense fallback={<OpportunitiesSkeleton />}>
            <OpportunitiesContainer />
          </Suspense>
        </FadeIn>
      </div>
    </PageTransition>
  )
}

async function OpportunitiesContainer() {
  // This will be replaced with actual data fetching
  const mockOpportunities = [
    {
      id: "1",
      keyword: "obsidian plugin development",
      category: "tech",
      phase: "emergence" as const,
      confidence: "high" as const,
      gap_score: 84.5,
      sources: ["reddit", "hackernews"],
      is_watched: false,
      first_seen_at: new Date().toISOString(),
    },
    {
      id: "2",
      keyword: "local llm deployment",
      category: "tech",
      phase: "innovation" as const,
      confidence: "medium" as const,
      gap_score: 78.2,
      sources: ["reddit", "google_trends"],
      is_watched: true,
      first_seen_at: new Date().toISOString(),
    },
  ]

  return (
    <OpportunitiesList
      opportunities={mockOpportunities}
      onToggleWatch={() => {}}
    />
  )
}

function OpportunitiesSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-32 w-full" />
      ))}
    </div>
  )
}
```

**Step 4: Verify dashboard displays**

Run: `npm run dev`
Expected: Dashboard shows with header, filters, and mock opportunity cards

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add dashboard page with opportunity cards"
```

---

## Phase 3: API Routes & Data Fetching

### Task 3.1: Create Opportunities API Route

**Files:**
- Create: `src/app/api/opportunities/route.ts`

**Step 1: Create GET endpoint**

```tsx
// src/app/api/opportunities/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const page = parseInt(searchParams.get('page') || '1')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const category = searchParams.get('category')
  const phase = searchParams.get('phase')
  const confidence = searchParams.get('confidence')
  const minGap = parseFloat(searchParams.get('min_gap') || '0')
  const watchedOnly = searchParams.get('watched_only') === 'true'

  const supabase = await createClient()

  let query = supabase
    .from('opportunities')
    .select(`
      *,
      topics!inner(first_seen_at, last_seen_at)
    `, { count: 'exact' })
    .gte('gap_score', minGap)
    .order('gap_score', { ascending: false })

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }
  if (phase && phase !== 'all') {
    query = query.eq('phase', phase)
  }
  if (confidence && confidence !== 'all') {
    query = query.eq('confidence', confidence)
  }
  if (watchedOnly) {
    query = query.eq('is_watched', true)
  }

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total: count || 0,
      pages: Math.ceil((count || 0) / limit)
    }
  })
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add opportunities API endpoint"
```

---

### Task 3.2: Create Opportunity Detail API Route

**Files:**
- Create: `src/app/api/opportunities/[id]/route.ts`

**Step 1: Create GET endpoint for single opportunity**

```tsx
// src/app/api/opportunities/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      topics(
        id,
        keyword,
        category,
        first_seen_at,
        last_seen_at,
        topic_sources(*),
        topic_signals(*)
      ),
      youtube_supply(*)
    `)
    .eq('id', params.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!opportunity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(opportunity)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('opportunities')
    .update({
      is_watched: body.is_watched,
      notes: body.notes,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: add opportunity detail API endpoint"
```

---

## Phase 4: Deep Dive Page

### Task 4.1: Create Deep Dive Page Layout

**Files:**
- Create: `src/app/opportunity/[id]/page.tsx`
- Create: `src/components/opportunities/score-cards.tsx`
- Create: `src/components/opportunities/momentum-chart.tsx`
- Create: `src/components/opportunities/sources-list.tsx`
- Create: `src/components/opportunities/youtube-analysis.tsx`
- Create: `src/components/opportunities/outlier-videos.tsx`

**Step 1: Install Recharts**

```bash
npm install recharts
```

**Step 2: Create ScoreCards component**

```tsx
// src/components/opportunities/score-cards.tsx
"use client"

import { motion } from "framer-motion"
import { TrendingUp, Youtube, Target, Shield } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface ScoreCardsProps {
  gapScore: number
  momentum: number
  supply: number
  phase: string
  confidence: string
}

export function ScoreCards({ gapScore, momentum, supply, phase, confidence }: ScoreCardsProps) {
  const cards = [
    {
      label: "Gap Score",
      value: gapScore.toFixed(1),
      icon: Target,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Momentum",
      value: momentum.toFixed(1),
      icon: TrendingUp,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Supply",
      value: supply.toFixed(1),
      icon: Youtube,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Confidence",
      value: confidence,
      icon: Shield,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Card className={`${card.bg} border-none`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <card.icon className={`h-4 w-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
```

**Step 3: Create MomentumChart component**

```tsx
// src/components/opportunities/momentum-chart.tsx
"use client"

import { motion } from "framer-motion"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MomentumChartProps {
  data: Array<{
    date: string
    momentum: number
  }>
}

export function MomentumChart({ data }: MomentumChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Momentum Trend (30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#888888"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="momentum"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#momentumGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

**Step 4: Create OutlierVideos component**

```tsx
// src/components/opportunities/outlier-videos.tsx
"use client"

import { motion } from "framer-motion"
import { ExternalLink, TrendingUp, Users, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface OutlierVideo {
  video_id: string
  title: string
  views: number
  subs: number
  vps_ratio: number
  age_days: number
}

interface OutlierVideosProps {
  videos: OutlierVideo[]
}

export function OutlierVideos({ videos }: OutlierVideosProps) {
  if (videos.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            Outlier Videos (Small Channels, Big Views)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {videos.map((video, index) => (
            <motion.div
              key={video.video_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className="p-4 rounded-lg bg-card/50 border border-border/50"
            >
              <a
                href={`https://youtube.com/watch?v=${video.video_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <h4 className="font-medium mb-2 group-hover:text-emerald-500 transition-colors flex items-center gap-2">
                  {video.title}
                  <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
              </a>
              <div className="flex flex-wrap gap-3 text-sm">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  {video.views.toLocaleString()} views
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {video.subs.toLocaleString()} subs
                </div>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  {video.vps_ratio.toFixed(1)}x VPS
                </Badge>
                <span className="text-muted-foreground">
                  {video.age_days} days ago
                </span>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

**Step 5: Create Deep Dive page**

```tsx
// src/app/opportunity/[id]/page.tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Star } from "lucide-react"
import { PageTransition } from "@/components/motion/page-transition"
import { FadeIn } from "@/components/motion/fade-in"
import { Button } from "@/components/ui/button"
import { ScoreCards } from "@/components/opportunities/score-cards"
import { MomentumChart } from "@/components/opportunities/momentum-chart"
import { OutlierVideos } from "@/components/opportunities/outlier-videos"
import { PhaseBadge } from "@/components/opportunities/phase-badge"
import { createClient } from "@/lib/supabase/server"

interface PageProps {
  params: { id: string }
}

export default async function OpportunityPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: opportunity, error } = await supabase
    .from('opportunities')
    .select(`
      *,
      topics(
        id,
        keyword,
        category,
        first_seen_at,
        last_seen_at,
        topic_sources(*),
        topic_signals(*)
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !opportunity) {
    notFound()
  }

  // Mock chart data - will be replaced with real signal history
  const chartData = Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    momentum: Math.random() * 30 + 50 + i * 0.5,
  }))

  // Mock outlier videos
  const outlierVideos = [
    {
      video_id: "abc123",
      title: "How I Built My First Obsidian Plugin in 2 Hours",
      views: 45000,
      subs: 1200,
      vps_ratio: 37.5,
      age_days: 12,
    },
  ]

  return (
    <PageTransition>
      <div className="space-y-6">
        <FadeIn>
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{opportunity.keyword}</h1>
                <PhaseBadge phase={opportunity.phase} />
              </div>
              <p className="text-muted-foreground">
                {opportunity.category} | First seen {new Date(opportunity.created_at).toLocaleDateString()}
              </p>
            </div>
            <Button variant="outline" className="gap-2">
              <Star className={`h-4 w-4 ${opportunity.is_watched ? "fill-yellow-500 text-yellow-500" : ""}`} />
              {opportunity.is_watched ? "Watching" : "Watch"}
            </Button>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <ScoreCards
            gapScore={opportunity.gap_score}
            momentum={opportunity.external_momentum}
            supply={opportunity.youtube_supply}
            phase={opportunity.phase}
            confidence={opportunity.confidence}
          />
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-6">
          <FadeIn delay={0.2}>
            <MomentumChart data={chartData} />
          </FadeIn>

          <FadeIn delay={0.3}>
            <OutlierVideos videos={outlierVideos} />
          </FadeIn>
        </div>
      </div>
    </PageTransition>
  )
}
```

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add opportunity deep dive page with charts"
```

---

## Phase 5: Python Worker Setup

### Task 5.1: Create Python Worker Project Structure

**Files:**
- Create: `worker/requirements.txt`
- Create: `worker/main.py`
- Create: `worker/collectors/__init__.py`
- Create: `worker/collectors/reddit.py`
- Create: `worker/collectors/hackernews.py`
- Create: `worker/collectors/google_trends.py`
- Create: `worker/collectors/wikipedia.py`
- Create: `worker/collectors/youtube.py`
- Create: `worker/scoring/__init__.py`
- Create: `worker/scoring/momentum.py`
- Create: `worker/scoring/supply.py`
- Create: `worker/scoring/gap.py`
- Create: `worker/db/__init__.py`
- Create: `worker/db/client.py`
- Create: `worker/Dockerfile`
- Create: `worker/railway.json`

**Step 1: Create requirements.txt**

```txt
# worker/requirements.txt
praw==7.7.1
pytrends==4.9.2
google-api-python-client==2.111.0
supabase==2.3.0
python-dotenv==1.0.0
requests==2.31.0
schedule==1.2.1
```

**Step 2: Create main.py**

```python
# worker/main.py
import os
import logging
from datetime import datetime
from dotenv import load_dotenv

from collectors.reddit import collect_reddit
from collectors.hackernews import collect_hackernews
from collectors.google_trends import collect_google_trends
from collectors.youtube import check_youtube_supply
from scoring.momentum import calculate_momentum_score
from scoring.supply import calculate_supply_score
from scoring.gap import calculate_gap_score, classify_phase, calculate_confidence
from db.client import get_supabase_client

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_scan():
    """Main scan function - runs all collectors and scoring."""
    logger.info("Starting scan...")
    supabase = get_supabase_client()

    # Create scan log entry
    scan = supabase.table('scan_log').insert({
        'status': 'running',
        'started_at': datetime.utcnow().isoformat()
    }).execute()
    scan_id = scan.data[0]['id']

    try:
        # Phase 1: Collect from all sources
        topics = []

        logger.info("Collecting from Reddit...")
        reddit_topics = collect_reddit()
        topics.extend(reddit_topics)

        logger.info("Collecting from HackerNews...")
        hn_topics = collect_hackernews()
        topics.extend(hn_topics)

        logger.info("Collecting from Google Trends...")
        trends_topics = collect_google_trends()
        topics.extend(trends_topics)

        logger.info(f"Collected {len(topics)} total topics")

        # Phase 2: Deduplicate and upsert topics
        unique_topics = deduplicate_topics(topics)
        upserted_topics = upsert_topics(supabase, unique_topics)

        # Phase 3: Check YouTube supply for each topic
        logger.info("Checking YouTube supply...")
        for topic in upserted_topics[:50]:  # Limit for API quota
            try:
                youtube_data = check_youtube_supply(topic['keyword'])
                save_youtube_supply(supabase, topic['id'], youtube_data)
            except Exception as e:
                logger.error(f"YouTube check failed for {topic['keyword']}: {e}")

        # Phase 4: Calculate scores and create opportunities
        logger.info("Calculating scores...")
        for topic in upserted_topics:
            try:
                momentum = calculate_momentum_score(supabase, topic['id'])
                supply_data = get_latest_supply(supabase, topic['id'])
                supply = calculate_supply_score(supply_data) if supply_data else 50
                gap = calculate_gap_score(momentum, supply)
                phase = classify_phase(momentum, supply, supply_data)
                confidence = calculate_confidence(supabase, topic['id'], momentum)

                upsert_opportunity(supabase, topic, momentum, supply, gap, phase, confidence)
            except Exception as e:
                logger.error(f"Scoring failed for {topic['keyword']}: {e}")

        # Complete scan
        supabase.table('scan_log').update({
            'status': 'completed',
            'completed_at': datetime.utcnow().isoformat(),
            'topics_detected': len(topics),
            'topics_updated': len(upserted_topics),
        }).eq('id', scan_id).execute()

        logger.info("Scan completed successfully!")

    except Exception as e:
        logger.error(f"Scan failed: {e}")
        supabase.table('scan_log').update({
            'status': 'failed',
            'errors': [{'message': str(e)}]
        }).eq('id', scan_id).execute()
        raise

if __name__ == "__main__":
    run_scan()
```

**Step 3: Create Dockerfile**

```dockerfile
# worker/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

**Step 4: Create railway.json**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "cronSchedule": "0 */6 * * *"
  }
}
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add Python worker project structure"
```

---

### Task 5.2: Implement Reddit Collector

**Files:**
- Modify: `worker/collectors/reddit.py`

**Step 1: Implement Reddit collector**

```python
# worker/collectors/reddit.py
import os
import re
import praw
from typing import List, Dict
from db.client import get_supabase_client

def collect_reddit() -> List[Dict]:
    """Collect rising posts from configured subreddits."""
    reddit = praw.Reddit(
        client_id=os.getenv('REDDIT_CLIENT_ID'),
        client_secret=os.getenv('REDDIT_CLIENT_SECRET'),
        user_agent='NicheRadar/1.0'
    )

    supabase = get_supabase_client()
    subreddits = supabase.table('subreddit_config').select('*').eq('is_active', True).execute()

    detected_topics = []

    for config in subreddits.data:
        try:
            subreddit = reddit.subreddit(config['subreddit'])

            # Get rising posts
            for post in subreddit.rising(limit=25):
                if post.score >= config['min_score']:
                    keywords = extract_keywords(post.title)

                    for keyword in keywords:
                        detected_topics.append({
                            'keyword': keyword,
                            'source': 'reddit',
                            'source_url': f"https://reddit.com{post.permalink}",
                            'source_title': post.title,
                            'source_metadata': {
                                'subreddit': config['subreddit'],
                                'score': post.score,
                                'num_comments': post.num_comments,
                            },
                            'category': config['category']
                        })

            # Also check hot posts
            for post in subreddit.hot(limit=25):
                if post.score >= config['min_score'] * 2:
                    keywords = extract_keywords(post.title)

                    for keyword in keywords:
                        detected_topics.append({
                            'keyword': keyword,
                            'source': 'reddit',
                            'source_url': f"https://reddit.com{post.permalink}",
                            'source_title': post.title,
                            'source_metadata': {
                                'subreddit': config['subreddit'],
                                'score': post.score,
                                'num_comments': post.num_comments,
                            },
                            'category': config['category']
                        })

        except Exception as e:
            print(f"Error collecting from r/{config['subreddit']}: {e}")
            continue

    return detected_topics


def extract_keywords(title: str) -> List[str]:
    """Extract searchable keywords from post title."""
    # Remove common prefixes
    title = re.sub(r'^(TIL|ELI5|CMV|TIFU|AMA|WIBTA|AITA)\s*:?\s*', '', title, flags=re.IGNORECASE)

    # Find quoted terms
    quoted = re.findall(r'"([^"]+)"', title)

    # Find noun phrases (simple heuristic: 2-4 capitalized words)
    phrases = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b', title)

    keywords = quoted + phrases

    # Normalize
    keywords = [k.lower().strip() for k in keywords if len(k) > 3]

    return list(set(keywords))[:3]  # Max 3 keywords per post
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: implement Reddit collector"
```

---

### Task 5.3: Implement HackerNews Collector

**Files:**
- Modify: `worker/collectors/hackernews.py`

```python
# worker/collectors/hackernews.py
import requests
from typing import List, Dict
from datetime import datetime, timezone

HN_API = "https://hacker-news.firebaseio.com/v0"

def collect_hackernews() -> List[Dict]:
    """Collect trending stories from Hacker News."""
    detected_topics = []

    # Get top stories
    top_ids = requests.get(f"{HN_API}/topstories.json").json()[:30]

    for story_id in top_ids:
        try:
            story = requests.get(f"{HN_API}/item/{story_id}.json").json()

            if story.get('type') != 'story':
                continue

            if story.get('score', 0) < 50:
                continue

            title = story.get('title', '')
            keywords = extract_hn_keywords(title)

            for keyword in keywords:
                detected_topics.append({
                    'keyword': keyword,
                    'source': 'hackernews',
                    'source_url': f"https://news.ycombinator.com/item?id={story_id}",
                    'source_title': title,
                    'source_metadata': {
                        'score': story.get('score'),
                        'descendants': story.get('descendants', 0),
                    },
                    'category': 'tech'
                })

        except Exception as e:
            print(f"Error fetching HN story {story_id}: {e}")
            continue

    return detected_topics


def extract_hn_keywords(title: str) -> List[str]:
    """Extract keywords from HN title."""
    import re

    # Remove "Show HN:", "Ask HN:", etc.
    title = re.sub(r'^(Show|Ask|Tell|Launch)\s+HN:\s*', '', title, flags=re.IGNORECASE)

    # Find product/project names (often in title case or all caps)
    products = re.findall(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b', title)

    keywords = [p.lower() for p in products if len(p) > 3]

    return list(set(keywords))[:2]
```

**Step 2: Commit**

```bash
git add .
git commit -m "feat: implement HackerNews collector"
```

---

## Phase 6: Analyse & Discover Pages

### Task 6.1: Create Analyse Page

**Files:**
- Create: `src/app/analyse/page.tsx`
- Create: `src/app/api/analyse/route.ts`

**Step 1: Create Analyse API route**

```tsx
// src/app/api/analyse/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { keyword } = await request.json()

  if (!keyword || keyword.length < 2) {
    return NextResponse.json({ error: 'Keyword required' }, { status: 400 })
  }

  // This will call the Python worker's on-demand analysis
  // For now, return mock data
  return NextResponse.json({
    keyword,
    analysis: {
      youtube_supply: {
        total_results: 1240,
        results_last_30_days: 8,
        avg_video_age_days: 245,
        title_match_ratio: 0.35,
        large_channel_count: 1,
        small_channel_count: 7,
      },
      external_signals: {
        reddit: null,
        hackernews: { found: true, score: 234 },
        google_trends: { value: 45, is_breakout: false },
      },
      calculated_scores: {
        momentum: 45.0,
        supply: 12.0,
        gap: 39.6,
      },
      phase: 'innovation',
      confidence: 'medium',
    }
  })
}
```

**Step 2: Create Analyse page**

```tsx
// src/app/analyse/page.tsx
"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Loader2 } from "lucide-react"
import { PageTransition } from "@/components/motion/page-transition"
import { FadeIn } from "@/components/motion/fade-in"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScoreCards } from "@/components/opportunities/score-cards"

export default function AnalysePage() {
  const [keyword, setKeyword] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleAnalyse = async () => {
    if (!keyword.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error('Analysis failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
        <FadeIn>
          <h1 className="text-3xl font-bold">Keyword Analyser</h1>
          <p className="text-muted-foreground">
            Analyse any keyword to see its YouTube opportunity potential
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card>
            <CardContent className="p-6">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Enter a keyword to analyse..."
                    className="pl-10"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyse()}
                  />
                </div>
                <Button onClick={handleAnalyse} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analysing...
                    </>
                  ) : (
                    'Analyse'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <ScoreCards
                gapScore={result.analysis.calculated_scores.gap}
                momentum={result.analysis.calculated_scores.momentum}
                supply={result.analysis.calculated_scores.supply}
                phase={result.analysis.phase}
                confidence={result.analysis.confidence}
              />

              <Card>
                <CardHeader>
                  <CardTitle>YouTube Supply Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Results</div>
                      <div className="text-2xl font-bold">
                        {result.analysis.youtube_supply.total_results.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Last 30 Days</div>
                      <div className="text-2xl font-bold">
                        {result.analysis.youtube_supply.results_last_30_days}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Avg Video Age</div>
                      <div className="text-2xl font-bold">
                        {result.analysis.youtube_supply.avg_video_age_days} days
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Title Match</div>
                      <div className="text-2xl font-bold">
                        {(result.analysis.youtube_supply.title_match_ratio * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  )
}
```

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add keyword analyse page"
```

---

## Phase 7: Deploy to Production

### Task 7.1: Deploy Frontend to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/juggajay/niche-radar.git
git push -u origin main
```

**Step 2: Import to Vercel**

- Go to Vercel dashboard
- Click "Add New" > "Project"
- Import from GitHub: `juggajay/niche-radar`
- Framework: Next.js (auto-detected)
- Add environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_KEY`

**Step 3: Deploy**

Click "Deploy" and wait for build to complete.

**Step 4: Verify deployment**

Visit the deployed URL and confirm app loads correctly.

---

### Task 7.2: Deploy Worker to Railway

**Step 1: Create Railway project**

- Go to Railway dashboard
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose the `niche-radar` repo
- Set root directory: `worker`

**Step 2: Configure environment variables**

Add in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `REDDIT_CLIENT_ID`
- `REDDIT_CLIENT_SECRET`
- `YOUTUBE_API_KEY`

**Step 3: Configure cron schedule**

Railway will auto-detect `railway.json` and set up the cron schedule.

**Step 4: Trigger initial scan**

Click "Deploy" and verify the worker runs successfully.

---

## Summary Checklist

### Phase 1: Foundation
- [ ] Initialize Next.js project
- [ ] Install and configure shadcn/ui
- [ ] Configure dark mode
- [ ] Install Framer Motion
- [ ] Set up Supabase client
- [ ] Create Supabase project and run schema
- [ ] Generate TypeScript types

### Phase 2: Core UI
- [ ] Create app shell layout with header
- [ ] Create animated page transitions
- [ ] Create OpportunityCard component
- [ ] Create Dashboard page

### Phase 3: API Routes
- [ ] Create opportunities API route
- [ ] Create opportunity detail API route

### Phase 4: Deep Dive Page
- [ ] Install Recharts
- [ ] Create score cards component
- [ ] Create momentum chart component
- [ ] Create outlier videos component
- [ ] Create deep dive page

### Phase 5: Python Worker
- [ ] Create worker project structure
- [ ] Implement Reddit collector
- [ ] Implement HackerNews collector
- [ ] Implement YouTube supply checker
- [ ] Implement scoring algorithms

### Phase 6: Analyse & Discover
- [ ] Create Analyse page
- [ ] Create Discover page

### Phase 7: Deploy
- [ ] Deploy frontend to Vercel
- [ ] Deploy worker to Railway
- [ ] Verify end-to-end flow

---

**Estimated API Keys Needed:**
1. Reddit API (client ID + secret)
2. YouTube Data API v3 key
3. Supabase project credentials

**UI/UX Highlights:**
- Dark mode by default (content creator preference)
- Smooth page transitions with Framer Motion
- Staggered card animations
- Gradient hover effects on cards
- Animated charts with Recharts
- Responsive design with Tailwind

---

Plan complete and saved to `docs/plans/2026-01-04-niche-radar.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
