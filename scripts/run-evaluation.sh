#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "=== Medário pt-BR Evaluation ==="
echo "Running EvaluationHarnessTests..."
echo ""

xcodebuild test \
  -scheme Medario \
  -destination 'platform=iOS Simulator,name=test-iphone' \
  -only-testing:MedarioTests/EvaluationHarnessTests \
  2>&1 | tee evaluation-output.txt

EXIT_CODE=$?
echo ""
echo "=== Evaluation complete ==="
if [ $EXIT_CODE -ne 0 ]; then
  echo "GATES FAILED — review evaluation-output.txt"
  exit 1
else
  echo "All gates passed."
  exit 0
fi