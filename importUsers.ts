import fs from "fs";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface CsvTransaction {
  created_at: string;
  thType: string;
  thDetails: string;
  thPoi: string;
  thStatus: string;
  uuid: string; // ignored, we’ll use real UUIDs
  thEmail: string;
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function main() {
  const transactions: CsvTransaction[] = [];

  // 1️⃣ Read transactionhistory.csv
  await new Promise<void>((resolve, reject) => {
    fs.createReadStream("transactionhistory.csv") // <-- name your file exactly
      .pipe(csv())
      .on("data", (row) => {
        transactions.push({
          created_at: row.created_at,
          thType: row.thType,
          thDetails: row.thDetails,
          thPoi: row.thPoi,
          thStatus: row.thStatus,
          uuid: row.uuid,
          thEmail: row.thEmail,
        });
      })
      .on("end", () => {
        console.log(`✅ Loaded ${transactions.length} transactions from CSV`);
        resolve();
      })
      .on("error", reject);
  });

// 2️⃣ Fetch ALL user UUIDs (handle pagination)
console.log("🔍 Fetching all user UUIDs from Supabase...");

const emailToUuid: Record<string, string> = {};
const PAGE_SIZE = 1000;
let from = 0;
let to = PAGE_SIZE - 1;

while (true) {
  const { data: batch, error } = await supabase
    .from("users")
    .select("id, email")
    .range(from, to);

  if (error) {
    console.error("❌ Error fetching users:", error.message);
    break;
  }

  if (!batch || batch.length === 0) break; // no more rows

  batch.forEach((u) => {
    if (u.email) emailToUuid[u.email.toLowerCase()] = u.id;
  });

  console.log(`📦 Fetched ${batch.length} users (${Object.keys(emailToUuid).length} total)`);

  if (batch.length < PAGE_SIZE) break; // reached last page

  from += PAGE_SIZE;
  to += PAGE_SIZE;
}

console.log(`✅ Loaded total ${Object.keys(emailToUuid).length} user UUIDs`);


  console.log(`✅ Found ${Object.keys(emailToUuid).length} users in database`);

  // 3️⃣ Insert transaction history records
  let imported = 0;
  let skipped = 0;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);
    const insertBatch = [];

    for (const t of chunk) {
      const email = (t.thEmail || "").trim().toLowerCase();
      const realUuid = emailToUuid[email];

      if (!realUuid) {
        console.warn(`⚠️ Skipping row: email not found (${t.thEmail})`);
        skipped++;
        continue;
      }

      insertBatch.push({
        created_at: t.created_at
          ? new Date(t.created_at).toISOString()
          : new Date().toISOString(),
        thType: capitalizeFirst(t.thType),
        thDetails: capitalizeFirst(t.thDetails),
        thPoi: capitalizeFirst(t.thPoi),
        thStatus: capitalizeFirst(t.thStatus),
        uuid: realUuid,
        thEmail: t.thEmail,
      });
    }

    if (insertBatch.length > 0) {
      const { error } = await supabase.from("TransactionHistory").insert(insertBatch);
      if (error) {
        console.error("❌ Insert error:", error.message);
      } else {
        imported += insertBatch.length;
        console.log(`✅ Inserted ${insertBatch.length} records (total ${imported})`);
      }
    }

    await new Promise((r) => setTimeout(r, 400)); // throttle for safety
  }

  console.log(`🎉 Done! Imported ${imported}, Skipped ${skipped}`);
}

main().catch((err) => console.error("💥 Fatal error:", err));
