"use client";

import { useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Download,
  Database,
  Shield,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type Status = "PASSED" | "FAILED" | "WARN";
type TestItem = {
  test: string;
  status: Status;
  message: string;
  humanNote: string;
  meta?: Record<string, any>;
};

const REQUIRED_TABLES = [
  "profiles",
  "crypto_balances",
  "euro_balances",
  "cad_balances",
  "usd_balances",
  "transactions",
  "transfers",
  "transaction_history",
  "payments",
  "cards",
  "crypto_transactions",
  "external_accounts",
];

const ADMIN_PASSWORD = "123456789";

export default function DatabaseTest() {
  const [testResults, setTestResults] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [rlsRows, setRlsRows] = useState<any[] | null>(null);
  const [extRows, setExtRows] = useState<any[] | null>(null);
  const [consRows, setConsRows] = useState<any[] | null>(null);
  const [estRows, setEstRows] = useState<any[] | null>(null);
  const [dbInfo, setDbInfo] = useState<any[] | null>(null);

  const [showPwd, setShowPwd] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);

  const [realtimeMs, setRealtimeMs] = useState<number | null>(null);
  const realtimeStartRef = useRef<number | null>(null);

  const projectInfo = useMemo(() => {
    const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
      /\/+$/,
      ""
    );
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    const maskedAnon = anon ? anon.slice(0, 6) + "…" + anon.slice(-4) : "";
    return { url, maskedAnon };
  }, []);

  const add = (arr: TestItem[], item: TestItem) => arr.push(item);

  const pingLatency = async (n = 5) => {
    const times: number[] = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      const { error } = await supabase
        .from("profiles")
        .select("*", { head: true, count: "exact" });
      const dt = performance.now() - t0;
      if (error) throw error;
      times.push(dt);
      // brief jitter
      await new Promise((r) => setTimeout(r, 80));
    }
    times.sort((a, b) => a - b);
    const p50 = Math.round(times[Math.floor(times.length * 0.5)]);
    const p95 = Math.round(
      times[Math.floor(times.length * 0.95) - 1] ?? times.at(-1)!
    );
    return { p50, p95, samples: times.map((t) => Math.round(t)) };
  };

  const realtimeProbe = async () => {
    try {
      const ch = supabase.channel("db-check-rt");
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Realtime timeout")),
          4000
        );
        ch.on("broadcast", { event: "ping" }, (_payload) => {
          if (realtimeStartRef.current != null) {
            const ms = Math.round(performance.now() - realtimeStartRef.current);
            setRealtimeMs(ms);
          }
          clearTimeout(timeout);
          ch.unsubscribe();
          resolve();
        }).subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            // send ping
            realtimeStartRef.current = performance.now();
            await ch.send({
              type: "broadcast",
              event: "ping",
              payload: { t: Date.now() },
            });
          }
        });
      });
      return true;
    } catch {
      setRealtimeMs(null);
      return false;
    }
  };

  const runChecks = async () => {
    setLoading(true);
    const results: TestItem[] = [];

    // 0) Environment sanity
    const envOk = Boolean(projectInfo.url && projectInfo.maskedAnon);
    add(results, {
      test: "Environment Variables",
      status: envOk ? "PASSED" : "FAILED",
      message: envOk
        ? `URL configured, anon key present (${projectInfo.maskedAnon})`
        : "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
      humanNote: envOk
        ? "The app knows how to reach the database."
        : "App is missing its database settings. A developer must set the environment variables.",
    });

    if (!envOk) {
      setTestResults(results);
      setLoading(false);
      return;
    }

    // 1) Auth details
    try {
      const { data: s } = await supabase.auth.getSession();
      const { data, error } = await supabase.auth.getUser();
      const user = data?.user ?? null;
      const expiresAt = s?.session?.expires_at
        ? s.session.expires_at * 1000
        : null;
      const msLeft = expiresAt ? expiresAt - Date.now() : null;
      const minLeft =
        msLeft != null ? Math.max(0, Math.round(msLeft / 60000)) : null;

      add(results, {
        test: "User Authentication",
        status: error || !user ? "FAILED" : "PASSED",
        message: error
          ? error.message
          : user
          ? `User: ${user.email ?? user.id}${
              minLeft != null ? ` (token ~${minLeft}m left)` : ""
            }`
          : "No user/session",
        humanNote: user
          ? "You are signed in. Protected tables should be accessible according to your policies."
          : "You are NOT signed in. Protected tables may appear locked.",
      });
    } catch (e: any) {
      add(results, {
        test: "User Authentication",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't check who you are. Try signing in again.",
      });
    }

    // 2) DB info
    try {
      const { data, error } = await supabase.rpc("get_db_info");
      if (error) throw error;
      setDbInfo(data);
      const row = data?.[0];
      add(results, {
        test: "Database Info",
        status: "PASSED",
        message: `${row?.server_version?.split(" ")[0] ?? "Postgres"} • ${
          row?.db_size_pretty
        } • TZ ${row?.timezone} • role ${row?.current_role}`,
        humanNote:
          "Basic database details: version, size, timezone and current user role.",
      });
    } catch (e: any) {
      add(results, {
        test: "Database Info",
        status: "FAILED",
        message: e.message,
        humanNote:
          "We couldn't read the database metadata. The diagnostic functions may not be installed.",
      });
    }

    // 3) RLS overview
    try {
      const { data, error } = await supabase.rpc("get_rls_overview");
      if (error) throw error;
      setRlsRows(data || []);

      const withPolicies = (data || []).filter(
        (r: any) => (r.policy_count ?? 0) > 0
      );
      const disabledWithPolicies = withPolicies.filter(
        (r: any) => !r.rls_enabled
      );
      const publicTables = (data || []).filter(
        (r: any) => !r.rls_enabled && (!r.policy_count || r.policy_count === 0)
      );

      add(results, {
        test: "RLS Overview",
        status: "PASSED",
        message: `Loaded ${data?.length ?? 0} tables`,
        humanNote:
          "RLS = Row Level Security. 'Enabled' means table rows are protected by policies.",
      });

      if (disabledWithPolicies.length > 0) {
        add(results, {
          test: "RLS Activation",
          status: "WARN",
          message: `${disabledWithPolicies.length} table(s) have policies but RLS is disabled`,
          humanNote:
            "Security policies exist but are not enforced. Enable RLS to activate them.",
          meta: { tables: disabledWithPolicies.map((x: any) => x.table_name) },
        });
      }

      if (publicTables.length > 0) {
        add(results, {
          test: "Public Tables",
          status: "WARN",
          message: `${publicTables.length} table(s) appear public (no RLS & no policies)`,
          humanNote:
            "These are readable with the public key. Fine for lookup data; review for sensitive information.",
          meta: { tables: publicTables.map((x: any) => x.table_name) },
        });
      }
    } catch (e: any) {
      add(results, {
        test: "RLS Overview",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't read the security rules from the database.",
      });
    }

    // 4) Table existence + simple read
    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await supabase.from(table).select("*").limit(1);
        const ok = !error;
        add(results, {
          test: `Table Access: ${table}`,
          status: ok ? "PASSED" : "FAILED",
          message: ok ? "Readable (no error)" : error!.message,
          humanNote: ok
            ? "This table can be accessed with current permissions. If it should be private, review RLS policies."
            : "Access denied with current permissions. If access is expected, sign in or adjust policies.",
        });
      } catch (e: any) {
        add(results, {
          test: `Table Access: ${table}`,
          status: "FAILED",
          message: e.message,
          humanNote:
            "We couldn't access this table with the current permissions.",
        });
      }
    }

    // 5) Extensions
    try {
      const { data, error } = await supabase.rpc("get_extensions");
      if (error) throw error;
      setExtRows(data);
      add(results, {
        test: "Extensions",
        status: "PASSED",
        message: `${data.length} extension(s) installed`,
        humanNote:
          "Shows installed Postgres extensions (e.g., pgcrypto, vector, uuid-ossp).",
      });
    } catch (e: any) {
      add(results, {
        test: "Extensions",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't list database extensions.",
      });
    }

    // 6) Constraints overview
    try {
      const { data, error } = await supabase.rpc("get_constraints_overview");
      if (error) throw error;
      setConsRows(data);
      const tablesWithNoPK = (data || []).filter(
        (r: any) => (r.pk_count ?? 0) === 0
      );
      add(results, {
        test: "Constraints",
        status: tablesWithNoPK.length === 0 ? "PASSED" : "WARN",
        message: `Found constraints for ${data.length} table(s); ${tablesWithNoPK.length} without primary keys`,
        humanNote:
          tablesWithNoPK.length === 0
            ? "All tables have proper primary keys for data integrity."
            : "Some tables lack primary keys. This might be intentional for logs/feeds, but review if unexpected.",
      });
    } catch (e: any) {
      add(results, {
        test: "Constraints",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't read table constraints.",
      });
    }

    // 7) Row-count estimates
    try {
      const { data, error } = await supabase.rpc("get_table_estimates");
      if (error) throw error;
      setEstRows(data);
      const heavy = (data || [])
        .filter((r: any) => Number(r.est_rows) > 1_000_000)
        .map((r: any) => r.table_name);
      add(results, {
        test: "Row Count Estimates",
        status: "PASSED",
        message: `Loaded estimates for ${data.length} table(s)`,
        humanNote: heavy.length
          ? `Some tables are very large (est. >1M rows): ${heavy
              .slice(0, 5)
              .join(", ")}`
          : "Table sizes look reasonable based on estimates.",
      });
    } catch (e: any) {
      add(results, {
        test: "Row Count Estimates",
        status: "FAILED",
        message: e.message,
        humanNote: "We couldn't load row-count estimates.",
      });
    }

    // 8) Latency benchmark (p50/p95)
    try {
      const bench = await pingLatency(5);
      const status: Status = bench.p95 > 2000 ? "WARN" : "PASSED";
      add(results, {
        test: "Latency Benchmark",
        status,
        message: `p50 ~${bench.p50}ms • p95 ~${
          bench.p95
        }ms • samples [${bench.samples.join(", ")}ms]`,
        humanNote:
          status === "WARN"
            ? "High latency detected. This may indicate network issues or database load."
            : "Response times look good. Lower is better; p95 shows worst-case performance.",
      });
    } catch (e: any) {
      add(results, {
        test: "Latency Benchmark",
        status: "FAILED",
        message: (e as Error).message,
        humanNote: "We couldn't measure round-trip latency to the database.",
      });
    }

    // 9) Realtime round-trip
    const rtOK = await realtimeProbe();
    add(results, {
      test: "Realtime Connectivity",
      status: rtOK && realtimeMs != null ? "PASSED" : "FAILED",
      message:
        rtOK && realtimeMs != null
          ? `Broadcast round-trip ~${realtimeMs}ms`
          : "Realtime test failed or timed out",
      humanNote: rtOK
        ? "Realtime channels are working for live updates."
        : "Realtime seems blocked or misconfigured.",
    });

    setTestResults(results);
    setLoading(false);
  };

  const asJson = useMemo(
    () =>
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          project: projectInfo,
          results: testResults,
          rls: rlsRows,
          dbInfo,
          extensions: extRows,
          constraints: consRows,
          estimates: estRows,
          realtimeMs,
        },
        null,
        2
      ),
    [
      testResults,
      rlsRows,
      dbInfo,
      extRows,
      consRows,
      estRows,
      realtimeMs,
      projectInfo,
    ]
  );

  const download = () => {
    const blob = new Blob([asJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `db-diagnostics-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/:/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const beginRun = () => {
    setPwd("");
    setPwdError(null);
    setShowPwd(true);
  };

  const confirmRun = async () => {
    if (pwd !== ADMIN_PASSWORD) {
      setPwdError("Incorrect password. Try again.");
      return;
    }
    setShowPwd(false);
    await runChecks();
  };

  const StatusBadge = ({ status }: { status: Status }) => {
    if (status === "PASSED")
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          PASSED
        </Badge>
      );
    if (status === "WARN")
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
          <AlertTriangle className="w-3 h-3 mr-1" />
          WARN
        </Badge>
      );
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
        <XCircle className="w-3 h-3 mr-1" />
        FAILED
      </Badge>
    );
  };

  const getStatusIcon = (status: Status) => {
    if (status === "PASSED")
      return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (status === "WARN")
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const passedCount = testResults.filter((r) => r.status === "PASSED").length;
  const warnCount = testResults.filter((r) => r.status === "WARN").length;
  const failedCount = testResults.filter((r) => r.status === "FAILED").length;

  return (
    <>
      <Card className="w-full max-w-6xl mx-auto mt-8 shadow-lg border-gray-200">
        <CardHeader className="space-y-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-blue-600" />
            <div>
              <CardTitle className="text-2xl text-gray-900">
                Database Diagnostics
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive read-only analysis of your Supabase database
                configuration and performance.
              </p>
            </div>
          </div>

          {testResults.length > 0 && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium">
                  {passedCount} Passed
                </span>
              </div>
              {warnCount > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-yellow-700 font-medium">
                    {warnCount} Warnings
                  </span>
                </div>
              )}
              {failedCount > 0 && (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-red-700 font-medium">
                    {failedCount} Failed
                  </span>
                </div>
              )}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6 p-6">
          <div className="flex items-center gap-3">
            <Button
              onClick={beginRun}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Run Database Tests
                </>
              )}
            </Button>

            {testResults.length > 0 && (
              <Button
                variant="outline"
                onClick={download}
                className="flex items-center gap-2 hover:bg-gray-50 border-gray-300 transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </Button>
            )}
          </div>

          {testResults.length > 0 && (
            <>
              <div className="space-y-4">
                {testResults.map((r, idx) => (
                  <div
                    key={idx}
                    className={`p-5 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${
                      r.status === "PASSED"
                        ? "border-l-green-500 bg-green-50 border border-green-200"
                        : r.status === "WARN"
                        ? "border-l-yellow-500 bg-yellow-50 border border-yellow-200"
                        : "border-l-red-500 bg-red-50 border border-red-200"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(r.status)}
                        <div className="font-semibold text-gray-900">
                          {r.test}
                        </div>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    <p className="text-sm text-gray-700 mt-2 font-mono bg-white/80 p-2 rounded border">
                      {r.message}
                    </p>

                    <div className="mt-3 p-3 rounded bg-white/90 border-l-2 border-l-blue-300">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="font-medium text-blue-900 text-sm">
                          Analysis
                        </span>
                      </div>
                      <p className="text-sm text-blue-800">{r.humanNote}</p>
                    </div>

                    {r.meta?.tables && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {r.meta.tables.map((table: string) => (
                          <Badge
                            key={table}
                            variant="outline"
                            className="text-xs"
                          >
                            {table}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Technical Details Sections */}
              {rlsRows && rlsRows.length > 0 && (
                <section className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-lg text-gray-900">
                      Row Level Security & Policies
                    </h3>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left p-3 font-semibold">Table</th>
                          <th className="text-left p-3 font-semibold">
                            RLS Status
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Forced
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Policies
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Policy Details
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rlsRows.map((r: any, idx: number) => (
                          <tr
                            key={r.table_name}
                            className={`${
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-blue-50 transition-colors`}
                          >
                            <td className="p-3 font-medium text-gray-900">
                              {r.table_name}
                            </td>
                            <td className="p-3">
                              {r.rls_enabled ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200">
                                  Enabled
                                </Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800 border-red-200">
                                  Disabled
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-gray-600">
                              {r.rls_forced ? "Yes" : "No"}
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary">
                                {r.policy_count || 0}
                              </Badge>
                            </td>
                            <td className="p-3 text-xs text-gray-600 max-w-md">
                              {r.policies_summary || "No policies"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Extensions */}
              {extRows && extRows.length > 0 && (
                <section className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-lg text-gray-900">
                      Installed Extensions
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {extRows.map((e: any) => (
                      <div
                        key={`${e.name}-${e.version}`}
                        className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="font-medium text-gray-900">
                          {e.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          Version {e.version}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Schema: {e.schema}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Constraints */}
              {consRows && consRows.length > 0 && (
                <section className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Database className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-lg text-gray-900">
                      Table Constraints
                    </h3>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left p-3 font-semibold">Table</th>
                          <th className="text-left p-3 font-semibold">
                            Primary Keys
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Foreign Keys
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Unique Constraints
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {consRows.map((c: any, idx: number) => (
                          <tr
                            key={c.table_name}
                            className={`${
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            } hover:bg-blue-50 transition-colors`}
                          >
                            <td className="p-3 font-medium text-gray-900">
                              {c.table_name}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  c.pk_count > 0 ? "secondary" : "outline"
                                }
                                className={
                                  c.pk_count > 0
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }
                              >
                                {c.pk_count}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary">{c.fk_count}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary">
                                {c.unique_count}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Row Estimates */}
              {estRows && estRows.length > 0 && (
                <section className="mt-8">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-lg text-gray-900">
                      Table Size Estimates
                    </h3>
                  </div>
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100 border-b">
                        <tr>
                          <th className="text-left p-3 font-semibold">Table</th>
                          <th className="text-left p-3 font-semibold">
                            Estimated Rows
                          </th>
                          <th className="text-left p-3 font-semibold">
                            Size Category
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {estRows.map((t: any, idx: number) => {
                          const rowCount = Number(t.est_rows);
                          const sizeCategory =
                            rowCount > 1000000
                              ? "Large"
                              : rowCount > 10000
                              ? "Medium"
                              : "Small";
                          const categoryColor =
                            rowCount > 1000000
                              ? "text-red-600"
                              : rowCount > 10000
                              ? "text-yellow-600"
                              : "text-green-600";

                          return (
                            <tr
                              key={t.table_name}
                              className={`${
                                idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                              } hover:bg-blue-50 transition-colors`}
                            >
                              <td className="p-3 font-medium text-gray-900">
                                {t.table_name}
                              </td>
                              <td className="p-3 font-mono">
                                {rowCount.toLocaleString()}
                              </td>
                              <td
                                className={`p-3 font-medium ${categoryColor}`}
                              >
                                {sizeCategory}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 italic">
                    Row estimates are based on PostgreSQL statistics and provide
                    fast approximations without scanning entire tables.
                  </p>
                </section>
              )}

              {/* Raw JSON Export */}
              <section className="mt-8">
                <h3 className="font-semibold text-lg text-gray-900 mb-3">
                  Technical Export
                </h3>
                <div className="relative">
                  <pre className="text-xs bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-64 border">
                    {asJson}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={download}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 border-gray-300"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                </div>
              </section>
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Dialog */}
      <Dialog open={showPwd} onOpenChange={setShowPwd}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Admin Authentication Required
            </DialogTitle>
            <DialogDescription>
              Enter the admin passcode to run comprehensive database
              diagnostics. This will perform read-only analysis of your database
              structure and security.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label
                htmlFor="admin-pass"
                className="text-sm font-medium text-gray-900"
              >
                Administrative Passcode
              </label>
              <Input
                id="admin-pass"
                type="password"
                value={pwd}
                onChange={(e) => {
                  setPwd(e.target.value);
                  setPwdError(null);
                }}
                placeholder="Enter admin passcode"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmRun();
                }}
                className="font-mono"
              />
              {pwdError && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {pwdError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              onClick={confirmRun}
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={!pwd.trim()}
            >
              <Database className="w-4 h-4 mr-2" />
              Run Diagnostics
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
