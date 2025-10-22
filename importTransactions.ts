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
  uuid: string; // original file has it, but we’ll override it with the real one from users
  thEmail: string;
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function main() {
  const transactions: CsvTransaction[] = [];

  // 1️⃣ Read CSV
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
        console.log(`✅ Loaded ${transactions.length} rows from CSV`);
        resolve();
      })
      .on("error", reject);
  });

  // 2️⃣ Fetch all user UUIDs (for matching by email)
  console.log("🔍 Fetching user UUIDs from database...");
  const { data: allUsers, error: usersError } = await supabase
    .from("users")
    .select("id, email");

  if (usersError) {
    console.error("❌ Error fetching users:", usersError.message);
    process.exit(1);
  }

  const emailToUuid: Record<string, string> = {};
  allUsers?.forEach((u) => {
    if (u.email) emailToUuid[u.email.toLowerCase()] = u.id;
  });

  console.log(`✅ Loaded ${Object.keys(emailToUuid).length} user UUIDs`);

  // 3️⃣ Process and insert transactions
  let imported = 0;
  let skipped = 0;
  const CHUNK_SIZE = 100;

  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    const chunk = transactions.slice(i, i + CHUNK_SIZE);

    const insertBatch = [];

    for (const t of chunk) {
      const email = (t.thEmail || "").trim().toLowerCase();
      const uuid = emailToUuid[email];

      if (!uuid) {
        console.warn(`⚠️  Skipping row: email not found (${t.thEmail})`);
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
        uuid,
        thEmail: t.thEmail,
      });
    }

    if (insertBatch.length > 0) {
      const { error } = await supabase.from("TransactionHistory").insert(insertBatch);
      if (error) {
        console.error("❌ Insert error:", error.message);
      } else {
        imported += insertBatch.length;
        console.log(`✅ Inserted ${insertBatch.length} records (total: ${imported})`);
      }
    }

    // Small delay to avoid hitting Supabase rate limits
    await new Promise((res) => setTimeout(res, 400));
  }

  console.log(`🎉 Import complete! Imported: ${imported}, Skipped: ${skipped}`);
}

main().catch((err) => console.error("💥 Fatal error:", err));
