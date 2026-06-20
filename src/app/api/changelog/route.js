import { exec } from "child_process";
import { NextResponse } from "next/server";
import util from "util";

const execAsync = util.promisify(exec);

export async function GET() {
  try {
    // 1. Fetch the last 50 commits
    // Format: Hash|Date|Subject|Body
    // Using a distinct delimiter like |~| to safely parse including any internal piped text
    const format = "%H|~|%aI|~|%s|~|%b";
    
    // Using simple git log. Assumes git is installed and repository is present.
    // In many Vercel deployments, git history is omitted by default, but typically latest commit details are there,
    // or this server is running on a managed VM or locally where full history exists.
    const { stdout } = await execAsync(`git log -n 50 --pretty=format:"${format}" || echo ""`);

    if (!stdout.trim()) {
      return NextResponse.json({ releases: [] });
    }

    const rawCommits = stdout.split('\n');
    let commits = [];
    
    let currentCommit = null;
    let bodyAccumulator = [];

    // Parse loop to handle multiline commit bodies correctly
    for (const line of rawCommits) {
      if (line.includes("|~|")) {
        if (currentCommit) {
          currentCommit.body = bodyAccumulator.join("\n").trim();
          commits.push(currentCommit);
        }
        
        const [hash, date, subject, ...bodyParts] = line.split("|~|");
        currentCommit = {
          hash,
          date, // ISO-8601 string
          subject: subject?.trim() || "",
        };
        bodyAccumulator = [bodyParts.join("|~|").trim()];
      } else {
        if (currentCommit) {
          bodyAccumulator.push(line);
        }
      }
    }
    
    // push the last commit
    if (currentCommit) {
      currentCommit.body = bodyAccumulator.join("\n").trim();
      commits.push(currentCommit);
    }

    // 2. Identify and Categorize
    // Very naive categorization logic based on text footprint
    const categorizedCommits = commits.map(commit => {
      const text = (commit.subject + " " + commit.body).toLowerCase();
      
      let type = "update"; // default
      let typeLabel = "Update";
      
      if (text.includes("feat") || text.includes("implement") || text.includes("add") || text.includes("new")) {
        type = "feature";
        typeLabel = "Feature";
      } else if (text.includes("fix") || text.includes("bug") || text.includes("resolve") || text.includes("error")) {
        type = "fix";
        typeLabel = "Fix";
      } else if (text.includes("remove") || text.includes("delete") || text.includes("deprecate")) {
        type = "removal";
        typeLabel = "Removal";
      } else if (text.includes("refactor") || text.includes("perf")) {
        type = "refactor";
        typeLabel = "Refactor";
      }

      return { ...commit, type, typeLabel };
    });

    // 3. Group by Date
    // Converts ISO Date string "2026-06-20T10:00:00Z" to "2026-06-20"
    const groups = {};
    categorizedCommits.forEach(commit => {
      if (!commit.date) return;
      const day = commit.date.split("T")[0]; 
      if (!groups[day]) groups[day] = [];
      groups[day].push(commit);
    });

    // Format structure as required by Frontend
    const releases = Object.entries(groups)
      .sort((a, b) => new Date(b[0]) - new Date(a[0])) // newest date first
      .map(([date, items]) => {
        return { date, items };
      });

    return NextResponse.json({ releases });

  } catch (error) {
    console.error("Failed to parse changelog:", error);
    // Silent fail returning empty array rather than breaking the application API layer
    return NextResponse.json({ releases: [], error: error.message }, { status: 200 });
  }
}
