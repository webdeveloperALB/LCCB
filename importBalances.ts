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
type BalanceCsvRow = {
  uemail?: string;
  mdeposits?: string;
  mtaxes?: string;
  monhold?: string;
  mpaidtaxes?: string;
};

/* ================= HELPERS ================= */
const csvFilePath = path.resolve(process.cwd(), "balance.csv");

const normalizeEmail = (email?: string) =>
  email?.trim().toLowerCase() || "";

const toNumber = (value?: string) => {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
};

/* ================= MAIN ================= */
async function run() {
  console.log("📄 BALANCE CSV PATH:", csvFilePath);

  const rows: BalanceCsvRow[] = [];

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

      let processed = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = normalizeEmail(row.uemail);

        if (VERBOSE && i % LOG_EVERY === 0) {
          console.log(`➡️ ${i + 1}/${rows.length}`);
        }

        /* -------- VALIDATION -------- */
        if (!email || !email.includes("@")) {
          skipped++;
          console.log("⚠️ SKIP: invalid email", row.uemail);
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
          console.log("⚠️ SKIP: user not found for email", email);
          continue;
        }

        const userId = user.id;

        const deposit = toNumber(row.mdeposits);
        const taxes = toNumber(row.mtaxes);
        const onHold = toNumber(row.monhold);
        const paidTaxes = toNumber(row.mpaidtaxes);

        console.log("👤 USER:", email, "UUID:", userId);
        console.log("💶 BALANCE:", deposit);
        console.log("🧾 TAXES:", { taxes, onHold, paidTaxes });

        /* -------- UPSERT EURO BALANCE -------- */
        const { error: balanceError } =
          await supabase
            .from("euro_balances")
            .upsert(
              {
                user_id: userId,
                balance: deposit
              },
              { onConflict: "user_id" }
            );

        if (balanceError) {
          failed++;
          console.log("❌ BALANCE FAIL:", email, balanceError.message);
          continue;
        }

        /* -------- UPSERT TAXES -------- */
        const { error: taxError } =
          await supabase
            .from("taxes")
            .upsert(
              {
                user_id: userId,
                taxes,
                on_hold: onHold,
                paid: paidTaxes
              },
              { onConflict: "user_id" }
            );

        if (taxError) {
          failed++;
          console.log("❌ TAX FAIL:", email, taxError.message);
          continue;
        }

        processed++;
        console.log("✅ IMPORTED BALANCE + TAXES:", email);
      }

      console.log("🎉 IMPORT COMPLETE");
      console.log("📊 SUMMARY");
      console.log("  Processed:", processed);
      console.log("  Skipped  :", skipped);
      console.log("  Failed   :", failed);
    });
}

run();
