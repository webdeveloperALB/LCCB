import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

/* ================= CONFIG ================= */
const VERBOSE = true;
const LOG_EVERY = 20;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/* ================= ENV ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("❌ Missing SUPABASE env vars");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/* ================= TYPES ================= */
type DepositCsvRow = {
  damount?: string;
  dtype?: string;
  ddetails?: string; // ✅ THIS IS EMAIL
  ddate?: string;
};

/* ================= HELPERS ================= */
const csvFilePath = path.resolve(process.cwd(), "deposit.csv");

const normalizeEmail = (v?: string) => v?.trim().toLowerCase() || "";
const toNumber = (v?: string) => Number(v || 0);

/* ================= MAIN ================= */
async function run() {
  console.log("📄 DEPOSIT CSV PATH:", csvFilePath);

  const rows: DepositCsvRow[] = [];

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ",",
        mapHeaders: ({ header }) =>
          header.replace(/^\uFEFF/, "").trim().toLowerCase()
      })
    )
    .on("data", (row) => rows.push(row))
    .on("end", async () => {
      console.log(`📦 CSV LOADED: ${rows.length} rows`);
      console.log("🔍 SAMPLE ROW:", rows[0]);
      console.log("🔑 HEADERS:", Object.keys(rows[0]));

      let inserted = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = normalizeEmail(row.ddetails);

        if (VERBOSE && i % LOG_EVERY === 0) {
          console.log(`➡️ ${i + 1}/${rows.length}`);
        }

        /* -------- VALIDATION -------- */
        if (!email || !email.includes("@")) {
          skipped++;
          console.log("⚠️ SKIP: invalid email in dDetails", row.ddetails);
          continue;
        }

        /* -------- FIND USER BY EMAIL -------- */
        const { data: user, error: userError } =
          await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (userError || !user) {
          skipped++;
          console.log("⚠️ SKIP: user not found", email);
          continue;
        }

        const userId = user.id;

        const amount = toNumber(row.damount);

        console.log("👤 USER:", email, "UUID:", userId);
        console.log("💰 DEPOSIT:", amount);

        /* -------- INSERT TRANSACTION -------- */
        const { error: insertError } =
          await supabase
            .from("TransactionHistory")
            .insert({
              uuid: userId,
              thEmail: email,
              thType: row.dtype || "Deposit",
              thDetails: `Deposit Amount: ${amount}`,
              thStatus: "Successful",
              created_at: row.ddate || undefined
            });

        if (insertError) {
          failed++;
          console.log("❌ INSERT FAIL:", email, insertError.message);
        } else {
          inserted++;
          console.log("✅ DEPOSIT TRANSACTION INSERTED:", email);
        }
      }
      console.log("🎉 IMPORT COMPLETE");
      console.log("📊 SUMMARY");
      console.log("  Inserted:", inserted);
      console.log("  Skipped :", skipped);
      console.log("  Failed  :", failed);
    });
}

run();
