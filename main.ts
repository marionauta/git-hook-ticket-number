import { $ } from "bun";
import { exit } from "node:process";

type BracketStyle = "none" | "round" | "square" | "curly";
type ContextPosition = "start" | "before_colon" | "after_colon";

interface Configuration {
  bracketStyle: BracketStyle;
  contextPosition: ContextPosition;
}

async function readConfiguration(): Promise<Configuration> {
  let configuration: Configuration = {
    bracketStyle: "square",
    contextPosition: "after_colon",
  };

  const bracketStyleCmd = await $`git config ghtn.bracketStyle`
    .quiet()
    .nothrow();
  if (bracketStyleCmd.exitCode) {
    console.warn(bracketStyleCmd.stderr.toString().trimEnd());
    return configuration;
  }
  const bracketStyle = bracketStyleCmd.text().trimEnd();
  if (bracketStyle) {
    configuration.bracketStyle = bracketStyle as BracketStyle;
  }
  const contextPositionCmd = await $`git config ghtn.contextPosition`
    .quiet()
    .nothrow();
  if (contextPositionCmd.exitCode) {
    console.warn(contextPositionCmd.stderr.toString().trimEnd());
    return configuration;
  }
  const contextPosition = contextPositionCmd.text().trimEnd();
  if (contextPosition) {
    configuration.contextPosition = contextPosition as ContextPosition;
  }
  return configuration;
}

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

function bracketize(line: string, bracketStyle: BracketStyle): string {
  switch (bracketStyle) {
    case "round":
      return `(${line})`;
    case "square":
      return `[${line}]`;
    case "curly":
      return `{${line}}`;
    default:
      return line;
  }
}

function apply(
  ticketNumber: string,
  commit: string,
  position: ContextPosition,
  bracketStyle: BracketStyle,
): string {
  const context = bracketize(ticketNumber, bracketStyle);
  if (position === "start") {
    return `${context} ${commit}`;
  }
  const colonIndex =
    commit.indexOf(":") + (position === "before_colon" ? 0 : 1);
  if (colonIndex < 0) return commit;
  return (
    commit.slice(0, colonIndex).trimEnd() +
    ` ${context}${position === "after_colon" ? " " : ""}` +
    commit.slice(colonIndex).trimStart()
  );
}

const argv = Bun.argv.slice(2); // skip bun & program name
const command = argv.shift();
switch (command) {
  case undefined:
    console.log(Bun.which("git-htn"));
    break;
  case "install":
    const hooksDirCmd = await $`git rev-parse --git-path hooks`
      .quiet()
      .nothrow();
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
    const configuration = await readConfiguration();
    if (!configuration) exit(0);
    const edited = apply(
      ticketNumber,
      line,
      configuration.contextPosition,
      configuration.bracketStyle,
    );
    const editedMessage = [edited, ...message.slice(1)].join("\n");
    await Bun.write(command, editedMessage);
    exit(0);
}
