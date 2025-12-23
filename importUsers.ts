import fs from "fs";
import path from "path";
import csv from "csv-parser";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

/* ================== CONFIG ================== */
const VERBOSE = true;
const LOG_EVERY = 50;

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

/* ================== ENV ================== */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("❌ Missing SUPABASE env vars");
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

/* ================== TYPES ================== */
type CsvUser = {
  uemail?: string;
  ufname?: string;
  ulname?: string;
  upassword?: string;
  created_at?: string;
  uverified?: string;
};

/* ================== HELPERS ================== */
const csvFilePath = path.resolve(process.cwd(), "users.csv");

const normalizeEmail = (email?: string) =>
  email?.trim().toLowerCase() || "";

const mapKycStatus = (value?: string) =>
  value?.toLowerCase() === "true" ? "approved" : "not_started";

/* ================== MAIN ================== */
async function run() {
  console.log("📄 CSV PATH:", csvFilePath);

  const users: CsvUser[] = [];
  const emailCounts = new Map<string, number>();

  fs.createReadStream(csvFilePath)
    .pipe(
      csv({
        separator: ",",
        mapHeaders: ({ header }) =>
          header.replace(/^\uFEFF/, "").trim().toLowerCase()
      })
    )
    .on("data", (row) => {
      users.push(row);

      const email = normalizeEmail(row.uemail);
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
    })
    .on("end", async () => {
      console.log(`📦 CSV LOADED: ${users.length} rows`);

      let imported = 0;
      let skipped = 0;
      let failed = 0;

      for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const email = normalizeEmail(user.uemail);

        if (VERBOSE && i % LOG_EVERY === 0) {
          console.log(`➡️ ${i + 1}/${users.length}`);
        }

        /* ---------- VALIDATION ---------- */
        if (!email || !email.includes("@")) {
          skipped++;
          console.log("⚠️ SKIP: invalid email", user.uemail);
          continue;
        }

        if (emailCounts.get(email)! > 1) {
          skipped++;
          console.log("⚠️ SKIP: duplicate email", email);
          continue;
        }

        const password = user.upassword || "TempPass123!";

        /* ---------- AUTH (UUID GENERATED HERE) ---------- */
        const { data, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
          });

        if (authError || !data?.user) {
          failed++;
          console.log("❌ AUTH FAIL:", email, authError?.message);
          continue;
        }

        const authUserId = data.user.id;

        console.log("🔐 AUTH OK:", email, "UUID:", authUserId);

        /* ---------- DB INSERT (USE AUTH UUID) ---------- */
        const { error: dbError } = await supabase.from("users").insert({
          id: authUserId,              // ✅ SAME UUID AS AUTH
          email,
          password,                    // 🔥 PLAINTEXT (as requested)
          first_name: user.ufname || null,
          last_name: user.ulname || null,
          full_name: `${user.ufname || ""} ${user.ulname || ""}`.trim(),
          created_at: user.created_at || null,
          kyc_status: mapKycStatus(user.uverified),
          bank_origin: "Lithuanian Crypto Central Bank"
        });

        if (dbError) {
          failed++;
          console.log("❌ DB FAIL:", email, dbError.message);
        } else {
          imported++;
          console.log("✅ IMPORTED:", email);
        }
      }

      console.log("🎉 IMPORT COMPLETE");
      console.log("📊 SUMMARY");
      console.log("  Imported:", imported);
      console.log("  Skipped :", skipped);
      console.log("  Failed  :", failed);
    });
}

run();
