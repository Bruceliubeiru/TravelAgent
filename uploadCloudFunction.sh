#!/usr/bin/env bash
set -euo pipefail

envId="${1:-}"
projectPath="${2:-}"
cliPath="${3:-${WECHAT_CLOUD_CLI:-${installPath:-}}}"

if [[ -z "${envId}" || -z "${projectPath}" ]]; then
  echo "Usage: ./uploadCloudFunction.sh <envId> <projectPath> [wechat-cli-path]" >&2
  exit 1
fi

if [[ -z "${cliPath}" ]]; then
  echo "Missing WeChat cloud CLI path. Pass it as the third argument or set WECHAT_CLOUD_CLI." >&2
  exit 1
fi

"${cliPath}" cloud functions deploy --e "${envId}" --n travelGateway --r --project "${projectPath}"
