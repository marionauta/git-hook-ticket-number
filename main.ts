import { $ } from "bun";
import { exit } from "node:process";

type BracketStyle = "none" | "round" | "square" | "curly";
type ContextPosition = "start" | "before_colon" | "after_colon";

async function getBranchName(): Promise<string | undefined> {
  const branchNameCmd = await $`git branch --show-current`.quiet().nothrow();
  if (branchNameCmd.exitCode) {
    console.warn(branchNameCmd.stderr.toString().trimEnd());
    return undefined;
  }
  return branchNameCmd.text();
}

function getTicketNumber(branchName: string): string | undefined {
  const matches = branchName.match(/((\w)+-(\d)+){1}/);
  if (!matches || matches.length === 0) exit(0);
  return matches.at(0)?.toUpperCase();
}

function bracketize(commit: string, bracketStyle: BracketStyle): string {
  switch (bracketStyle) {
    case "none": return commit;
    case "round": return `(${commit})`;
    case "square": return `[${commit}]`;
    case "curly": return `{${commit}}`;
  }
}

function apply(ticketNumber: string, commit: string, position: ContextPosition, bracketStyle: BracketStyle): string {
  const context = bracketize(ticketNumber, bracketStyle);
  if (position === "start") {
    return `${context} ${commit}`;
  }
  const colonIndex = commit.indexOf(":") + (position === "before_colon" ? 0 : 1);
  if (colonIndex < 0) return commit;
  return commit.slice(0, colonIndex).trimEnd() + ` ${context}${position === "after_colon" ? " " : ""}` + commit.slice(colonIndex).trimStart();
}

const argv = Bun.argv.slice(2); // skip bun & program name
const command = argv.shift();
switch (command) {
  case undefined:
    break;
  case "install":
    const hooksDirCmd = await $`git rev-parse --git-path hooks`.quiet().nothrow();
    if (hooksDirCmd.exitCode) {
      console.warn(hooksDirCmd.stderr.toString().trimEnd());
      exit(hooksDirCmd.exitCode);
    }
    const hooksDir = hooksDirCmd.text().trimEnd();
    console.info(`Installing to ${hooksDir}...`);
    await $`cp ${Bun.which("git-htn")} ${hooksDir}/commit-msg`;
    break;
  default:
    const message = (await Bun.file(command).text()).split("\n");
    if (!message) exit(1);
    const line = message.at(0);
    if (!line) exit(1);
    const branchName = await getBranchName();
    if (!branchName) exit(0);
    const ticketNumber = getTicketNumber(branchName);
    if (!ticketNumber) exit(0);
    if (line.toUpperCase().includes(ticketNumber)) exit(0);
    const edited = apply(ticketNumber, line, "after_colon", "square");
    const editedMessage = [edited, ...message.slice(1)].join("\n");
    await Bun.write(command, editedMessage);
    exit(0);
}
