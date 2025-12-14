import axios from "axios";
import fs from "fs";

const token = process.env.TOKEN;
const owner = process.env.OWNER;
const repo = process.env.REPO;

if (!token || !owner || !repo) {
  throw new Error("Missing TOKEN / OWNER / REPO env variables");
}

/**
 * FOR LOCAL TESTING
 * Change later if needed
 */
const TARGET_USERS = ["anurag2787"];
const MY_USERNAME = "anurag2787";
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
        state: "all",
        sort: "created",
        direction: "asc",
        per_page: 100,
      },
    }
  );

  let maxSeen = lastIssue;

  for (const issue of issues) {
    // ❌ Skip PRs
    if (issue.pull_request) continue;

    // ❌ Skip closed issues (THIS IS WHAT YOU ASKED FOR)
    if (issue.state === "closed") continue;

    // ❌ Skip already processed
    if (issue.number <= lastIssue) continue;

    // Track progress safely
    if (issue.number > maxSeen) {
      maxSeen = issue.number;
    }

    const author = issue.user?.login;

    // ❌ Skip if author not target
    if (!TARGET_USERS.includes(author)) continue;

    const body = `@${author} could you please assign this to me? I’m familiar with this area and would like to take it up.`;

    await api.post(issue.comments_url, { body });
    console.log(`✅ Commented on issue #${issue.number}`);
  }

  // Persist progress
  fs.writeFileSync(STATE_FILE, String(maxSeen));
  console.log(`📌 Last processed issue: ${maxSeen}`);
}

run().catch(err => {
  console.error("❌ Error:", err.response?.data || err.message);
  process.exit(1);
});
