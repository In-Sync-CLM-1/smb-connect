import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface LoginActivityPoint {
  day: string;
  login_count: number;
  unique_users: number;
}

export function LoginActivityCard({ description }: { description?: string }) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [points, setPoints] = useState<LoginActivityPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const startDate =
          timeRange === 'all'
            ? new Date('2020-01-01').toISOString()
            : new Date(
                Date.now() -
                  (timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90) * 86400000
              ).toISOString();

        const { data, error } = await supabase.rpc('get_login_activity', {
          p_start_date: startDate,
        });
        if (error) throw error;
        if (!cancelled) setPoints((data || []) as LoginActivityPoint[]);
      } catch (e) {
        console.error('Failed to load login activity:', e);
        if (!cancelled) setPoints([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Login Activity
            </CardTitle>
            <CardDescription>
              {description || 'Daily logins across your members'}
            </CardDescription>
          </div>
          <Tabs
            value={timeRange}
            onValueChange={(v) => setTimeRange(v as '7d' | '30d' | '90d' | 'all')}
          >
            <TabsList>
              <TabsTrigger value="7d">7 Days</TabsTrigger>
              <TabsTrigger value="30d">30 Days</TabsTrigger>
              <TabsTrigger value="90d">90 Days</TabsTrigger>
              <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : points.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            No login activity in this period yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="login_count"
                name="Logins"
                stroke="#0088FE"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="unique_users"
                name="Unique users"
                stroke="#00C49F"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export async function fetchLastLogins(
  userIds: string[]
): Promise<Map<string, string | null>> {
  if (userIds.length === 0) return new Map();
  try {
    const { data, error } = await supabase.rpc('get_users_last_login', {
      p_user_ids: userIds,
    });
    if (error) throw error;
    return new Map((data || []).map((d: any) => [d.user_id, d.last_sign_in_at ?? null]));
  } catch (e) {
    console.error('Failed to load last login times:', e);
    return new Map();
  }
}
