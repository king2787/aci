import axios from "axios";
import fs from "fs";
import path from "path";

/* =======================
   ENV VALIDATION (LOUD)
   ======================= */
const TOKEN = process.env.TOKEN;
const OWNER = process.env.OWNER;
const REPO = process.env.REPO;

console.log("ENV CHECK =>", {
  TOKEN: TOKEN ? "SET" : "MISSING",
  OWNER,
  REPO,
});

if (!TOKEN || !OWNER || !REPO) {
  throw new Error("Missing TOKEN / OWNER / REPO env variables");
}

/* =======================
   CONFIG
   ======================= */
const TARGET_USERS = ["anurag2787"];
const MY_USERNAME = "anurag2787";

const STATE_DIR = "state";
const STATE_FILE = path.join(STATE_DIR, "last_issue.txt");

if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR);
}

/* =======================
   API CLIENT
   ======================= */
const api = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/vnd.github+json",
  },
});

/* =======================
   LOAD STATE
   ======================= */
let lastIssue = 0;
if (fs.existsSync(STATE_FILE)) {
  lastIssue = Number(fs.readFileSync(STATE_FILE, "utf-8")) || 0;
}

/* =======================
   MAIN
   ======================= */
async function run() {
  const { data: issues } = await api.get(
    `/repos/${OWNER}/${REPO}/issues`,
    {
      params: {
        state: "all",
        sort: "created",
        direction: "asc",
        per_page: 100,
      },
    }
  );

  let maxSeen = lastIssue;

  for (const issue of issues) {
    // Skip PRs
    if (issue.pull_request) continue;

    // Skip closed issues
    if (issue.state === "closed") continue;

    // Skip already processed
    if (issue.number <= lastIssue) continue;

    if (issue.number > maxSeen) {
      maxSeen = issue.number;
    }

    const author = issue.user?.login;

    if (!TARGET_USERS.includes(author)) continue;
    if (author === MY_USERNAME) continue;

    const body = `@${author} could you please assign this to me? I’m familiar with this area and would like to take it up.`;

    await api.post(issue.comments_url, { body });
    console.log(`✅ Commented on issue #${issue.number}`);
  }

  fs.writeFileSync(STATE_FILE, String(maxSeen));
  console.log(`📌 Last processed issue: ${maxSeen}`);
}

run().catch(err => {
  console.error("❌ Error:", err.response?.data || err.message);
  process.exit(1);
});
