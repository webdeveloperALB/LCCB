import fs from "fs";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface CsvRow {
  created_at: string;
  mDeposit: string;
  mTaxes: string;
  mBalance: string; // ignored
  mOnhold: string;
  mPaidTax: string;
  uEmail: string;
}

// robust number parser: strips commas/spaces/currency
const toNum = (v: any, dp = 8): number => {
  const n = parseFloat(String(v ?? "0").replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return 0;
  return parseFloat(n.toFixed(dp));
};

const isoOrNow = (s?: string) => {
  try {
    if (!s) return new Date().toISOString();
    const d = new Date(s);
    if (isNaN(d.getTime())) return new Date().toISOString();
    return d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

async function loadEmailToUuidMap(): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const PAGE = 1000;

  // users
  let from = 0, to = PAGE - 1;
  while (true) {
    const { data, error } = await supabase.from("users").select("id,email").range(from, to);
    if (error) throw new Error(`users select: ${error.message}`);
    if (!data?.length) break;
    for (const u of data) if (u.email) map[u.email.toLowerCase()] = u.id;
    if (data.length < PAGE) break;
    from += PAGE; to += PAGE;
  }

  // profiles (fill any gaps)
  from = 0; to = PAGE - 1;
  while (true) {
    const { data, error } = await supabase.from("profiles").select("id,email").range(from, to);
    if (error) throw new Error(`profiles select: ${error.message}`);
    if (!data?.length) break;
    for (const p of data) if (p.email && !map[p.email.toLowerCase()]) map[p.email.toLowerCase()] = p.id;
    if (data.length < PAGE) break;
    from += PAGE; to += PAGE;
  }

  // auth.users last (admin)
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`auth.listUsers: ${error.message}`);
    const batch = data?.users ?? [];
    if (!batch.length) break;
    for (const u of batch) {
      const em = u.email?.toLowerCase();
      if (em && !map[em]) map[em] = u.id;
    }
    page++;
  }

  return map;
}

async function main() {
  // -------- 0) READ CSV ----------
  const rows: CsvRow[] = [];
  await new Promise<void>((resolve, reject) => {
    // set to your filename
    fs.createReadStream("money.csv")
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });
  console.log(`✅ Loaded ${rows.length} rows from CSV`);

  // -------- 1) EMAIL -> UUID MAP ----------
  console.log("🔍 Building email→UUID map from users, profiles, auth.users...");
  const emailToUuid = await loadEmailToUuidMap();
  console.log(`✅ Known users: ${Object.keys(emailToUuid).length}`);

  // -------- 2) BUILD DEDUPED PAYLOADS ----------
  // One euro balance per user (last value wins)
  const euroByUser = new Map<string, any>();
  // One taxes row per user (last values win)
  const taxesByUser = new Map<string, any>();
  // Many deposits rows allowed (only mDeposit > 0)
  const depositsAll: any[] = [];

  let skipped = 0;

  for (const r of rows) {
    const email = (r.uEmail || "").trim().toLowerCase();
    const uuid = emailToUuid[email];
    if (!uuid) { skipped++; continue; }

    const created = isoOrNow(r.created_at);
    const mOnhold  = toNum(r.mOnhold, 8);
    const mDeposit = toNum(r.mDeposit, 8);
    const mTaxes   = toNum(r.mTaxes, 2);
    const mPaidTax = toNum(r.mPaidTax, 2);

    // euro_balances: last mOnhold wins
    euroByUser.set(uuid, {
      user_id: uuid,
      balance: mOnhold,
      created_at: created,
    });

    // deposits: store ONLY the number in thDetails; insert only if > 0
    if (mDeposit > 0) {
      depositsAll.push({
        uuid,
        thEmail: r.uEmail,
        created_at: created,
        thDetails: String(mDeposit), // number only; others use defaults
      });
    }

    // taxes: last values win; taxes=0, on_hold=mTaxes, paid=mPaidTax
    taxesByUser.set(uuid, {
      user_id: uuid,
      taxes: 0,
      on_hold: mTaxes,
      paid: mPaidTax,
      created_at: created,
    });
  }

  console.log(`🧾 Prepared: euro_users=${euroByUser.size}, taxes_users=${taxesByUser.size}, deposit_rows=${depositsAll.length}, skipped_no_user=${skipped}`);

  // -------- 3) WRITE TO DB (CHUNKED) ----------
  // 3a) euro_balances: upsert by user_id (deduped already)
  {
    const euroRows = Array.from(euroByUser.values());
    for (let i = 0; i < euroRows.length; i += 500) {
      const chunk = euroRows.slice(i, i + 500);
      const { error } = await supabase.from("euro_balances").upsert(chunk, { onConflict: "user_id" });
      if (error) {
        console.error("❌ euro_balances upsert error:", error.message);
      } else {
        console.log(`✅ euro_balances upserted: ${chunk.length} (total ${Math.min(i + 500, euroRows.length)}/${euroRows.length})`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 3b) taxes: single row per user — delete existing rows for these users, then insert fresh
  {
    const taxRows = Array.from(taxesByUser.values());
    const userIds = taxRows.map(t => t.user_id);

    // delete existing taxes for these users in chunks (so we don't need a unique index)
    for (let i = 0; i < userIds.length; i += 600) {
      const ids = userIds.slice(i, i + 600);
      const { error } = await supabase.from("taxes").delete().in("user_id", ids);
      if (error) console.error("⚠️ taxes delete error:", error.message);
      await new Promise((r) => setTimeout(r, 120));
    }

    // insert fresh one-per-user taxes rows
    for (let i = 0; i < taxRows.length; i += 500) {
      const chunk = taxRows.slice(i, i + 500);
      const { error } = await supabase.from("taxes").insert(chunk);
      if (error) console.error("❌ taxes insert error:", error.message);
      else console.log(`✅ taxes inserted: ${chunk.length} (total ${Math.min(i + 500, taxRows.length)}/${taxRows.length})`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // 3c) deposits: insert all (only rows where mDeposit > 0)
  {
    for (let i = 0; i < depositsAll.length; i += 1000) {
      const chunk = depositsAll.slice(i, i + 1000);
      const { error } = await supabase.from("deposits").insert(chunk);
      if (error) console.error("❌ deposits insert error:", error.message);
      else console.log(`✅ deposits inserted: ${chunk.length} (total ${Math.min(i + 1000, depositsAll.length)}/${depositsAll.length})`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  console.log("🎉 Done.");
}

main().catch((e) => console.error("💥 Fatal error:", e));
