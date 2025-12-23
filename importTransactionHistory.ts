import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

/* ================= CONFIG ================= */
const VERBOSE = true;
const LOG_EVERY = 50;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/* ================= ENV ================= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("❌ Missing SUPABASE env vars");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/* ================= TYPES ================= */
type TransactionCsvRow = {
  created_at?: string;
  thtype?: string;
  thdetails?: string;
  thpoi?: string;
  thstatus?: string;
  themail?: string;
};

/* ================= HELPERS ================= */
const csvFilePath = path.resolve(process.cwd(), "TransactionHistory.csv");

const normalizeEmail = (email?: string) =>
  email?.trim().toLowerCase() || "";

/* ================= MAIN ================= */
async function run() {
  console.log("📄 TRANSACTION CSV PATH:", csvFilePath);

  const rows: TransactionCsvRow[] = [];

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
        const email = normalizeEmail(row.themail);

        if (VERBOSE && i % LOG_EVERY === 0) {
          console.log(`➡️ ${i + 1}/${rows.length}`);
        }

        /* -------- VALIDATION -------- */
        if (!email || !email.includes("@")) {
          skipped++;
          console.log("⚠️ SKIP: invalid email", row.themail);
          continue;
        }

        /* -------- FIND USER -------- */
        const { data: user, error: userError } =
          await supabase
            .from("users")
            .select("id")
            .eq("email", email)
            .single();

        if (userError || !user) {
          skipped++;
          console.log("⚠️ SKIP: user not found for email", email);
          continue;
        }

        const userId = user.id;

        console.log("👤 USER FOUND:", email, "UUID:", userId);

        /* -------- INSERT TRANSACTION -------- */
        const { error: insertError } =
          await supabase
            .from("TransactionHistory")
            .insert({
              uuid: userId,
              thEmail: email,
              thType: row.thtype || "External Deposit",
              thDetails: row.thdetails || "Funds extracted by Estonian authorities",
              thPoi: row.thpoi || "Estonia Financial Intelligence Unit (FIU)",
              thStatus: row.thstatus || "Successful",
              created_at: row.created_at || undefined
            });

        if (insertError) {
          failed++;
          console.log("❌ INSERT FAIL:", email, insertError.message);
        } else {
          inserted++;
          console.log("✅ TRANSACTION INSERTED:", email);
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
