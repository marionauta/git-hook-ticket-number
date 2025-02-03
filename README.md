# git-hook-ticket-number

A git hook to automatically add a ticket number to the commit message,
based on the branch name. It produces a commit message like the following:

```
feat: [ENG-123] something
feat: {ENG-123} something
feat (ENG-123): something
ENG-123 feat: something
```

## Usage

`git-htn` runs on every commit, after you write a message, and adds the ticket
number if it finds one.

It requires that the git branch name starts with the ticket number. A valid
ticket number has the format `((\w)+-(\d)+)`, meaning some letters, a dash, and
some numbers. Valid branch numbers include:

```
e-123
ENG-1
eng-123-something-to-do
```

Style can be configured via the `git config` command:

```sh
git config ghtn.bracketStyle "round" # "none", "round", "square" or "curly"
git config ghtn.contextPosition "start" # "start", "before_colon" or "after_colon"
```

Optionally, you can use `git config --global`.

## Build

It requires the [bun][bun] runtime, once installed run

```bash
bun install
bun compile
```

You should now have a `git-htn` executable.

## Install

1. Place the `git-htn` executable somewhere in your `$PATH`. You can check it by
running `git-htn` or `git htn` and it should print its location.
1. Install the hook in a local repo by running `git htn install`.

[bun]: https://bun.sh
