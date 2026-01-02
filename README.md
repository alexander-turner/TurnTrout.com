[![Node tests](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/node.js.yml/badge.svg)](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/node.js.yml) ![Python tests pass](https://img.shields.io/badge/Python%20tests-Passing-green?style=plastic)[^python] ![Python type-checking](https://img.shields.io/badge/Python%20typechecking-Passing-green?style=plastic) [![ESLint](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/eslint.yml/badge.svg)](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/eslint.yml)  [![DeepSource](https://app.deepsource.com/gh/alexander-turner/TurnTrout.com.svg/?label=active+issues&show_trend=true&token=Uwx9Q68JFvapkwk26AqQzswN)](https://app.deepsource.com/gh/alexander-turner/TurnTrout.com/) 

100% Python line coverage and 100% TypeScript branch coverage.

# Setup

```shell
SITE_DIR=/tmp/TurnTrout.com
git clone https://github.com/alexander-turner/TurnTrout.com.git "$SITE_DIR" --depth 1
cd "$SITE_DIR"
pnpm install --frozen-lockfile
pnpm dev
```

# Cryptographic timestamp verification

To [verify that one of my commits was produced at a given date](https://turntrout.com/design#finishing-touches), you need to check out another repository:

```shell
git clone https://github.com/alexander-turner/.timestamps
cd .timestamps
ots --no-bitcoin verify "files/$full_commit_hash.txt.ots" 
```

The above `ots` ([Open Timestamp](https://github.com/opentimestamps/opentimestamps-client/blob/master/README.md)) command is written assuming you don't have a local copy of the blockchain and are instead willing to trust external calendar services. The commit times can be inspected zero-trust by downloading the blockchain and removing `--no-bitcoin`.

# Notes
- Run `git config core.hooksPath .hooks` to use the repository's hooks. 

[^python]: Python testing and type-checking are run locally and not on GitHub actions.


`turntrout.com` © 2024-2026 by Alexander Turner is licensed under CC BY-SA 4.0. Feel free to fork to use on your own website, but in addition to the licensing requirements of CC BY-SA 4.0:

1. Change out the content for your own,
2. Change the presentation in some way to visually distinguish it from my site (perhaps by just choosing a new set of colors for the theme),
3. Please provide prominent credit to this project for forming the backbone of your site design.

