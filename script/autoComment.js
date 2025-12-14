import axios from "axios";
import fs from "fs";
import { execSync } from "child_process";

const token = process.env.TOKEN;
const owner = process.env.OWNER;
const repo = process.env.REPO;

if (!token || !owner || !repo) {
  throw new Error("Missing TOKEN / OWNER / REPO env variables");
}

/**
 * LOCAL TESTING MODE
 * Change TARGET_USERS later for OSS repos
 */
const TARGET_USERS = ["king2787", "arkid15r", "kasya"];
const STATE_FILE = "state/last_issue.txt";

const api = axios.create({
  baseURL: "https://api.github.com",
  headers: {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  },
});

// Read last processed issue number
let lastIssue = 0;
if (fs.existsSync(STATE_FILE)) {
  lastIssue = Number(fs.readFileSync(STATE_FILE, "utf-8")) || 0;
}

async function run() {
  const { data: issues } = await api.get(
    `/repos/${owner}/${repo}/issues`,
    {
      params: {
        state: "open", // only open issues
        sort: "created",
        direction: "asc",
        per_page: 100,
      },
    }
  );

  let maxSeen = lastIssue;

  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (issue.number <= lastIssue) continue;

    // Always update progress
    if (issue.number > maxSeen) {
      maxSeen = issue.number;
    }

    const author = issue.user?.login;
    if (!TARGET_USERS.includes(author)) continue;

    const body = `@${author} could you please assign this to me? I’m familiar with this area and would like to take it up.`;

    await api.post(issue.comments_url, { body });
    console.log(`✅ Commented on issue #${issue.number}`);
  }

  // If nothing changed, don’t commit
  if (maxSeen === lastIssue) {
    console.log("ℹ️ No new issues. State unchanged.");
    return;
  }

  // Persist progress locally
  fs.writeFileSync(STATE_FILE, String(maxSeen));
  console.log(`📌 Updated last issue to ${maxSeen}`);

  // Commit & push state file
  try {
    execSync('git config user.email "bot@example.com"');
    execSync('git config user.name "GitHub Action Bot"');
    execSync(`git add ${STATE_FILE}`);
    execSync(`git commit -m "chore: update last processed issue to ${maxSeen}"`);
    execSync("git push");
    console.log("🚀 State committed to repository");
  } catch (err) {
    console.warn("⚠️ Failed to push state update:", err.message);
  }
}

run().catch(err => {
  console.error("❌ Error:", err.response?.data || err.message);
  process.exit(1);
});
