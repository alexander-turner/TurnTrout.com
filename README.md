[![Node tests](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/node.js.yml/badge.svg)](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/node.js.yml) ![Python tests pass](https://img.shields.io/badge/Python%20tests-Passing-green?style=plastic)[^python] ![Python type-checking](https://img.shields.io/badge/Python%20typechecking-Passing-green?style=plastic) [![ESLint](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/eslint.yml/badge.svg)](https://github.com/alexander-turner/TurnTrout.com/actions/workflows/eslint.yml)  [![DeepSource](https://app.deepsource.com/gh/alexander-turner/TurnTrout.com.svg/?label=active+issues&show_trend=true&token=Uwx9Q68JFvapkwk26AqQzswN)](https://app.deepsource.com/gh/alexander-turner/TurnTrout.com/) ![100% code coverage](https://assets.turntrout.com/coverage-badge.svg)

# Setup

```shell
SITE_DIR=/tmp/TurnTrout.com
git clone https://github.com/alexander-turner/TurnTrout.com.git "$SITE_DIR" --depth 1
cd "$SITE_DIR"
yes | npm ci
npx quartz build --serve
firefox localhost:8080/welcome.html
```

The [original Quartz documentation](https://quartz.jzhao.xyz/) remains mostly relevant (and also present in `docs/`).

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


`turntrout.com` © 2024–2025 by Alexander Turner is licensed under CC BY-SA 4.0.
