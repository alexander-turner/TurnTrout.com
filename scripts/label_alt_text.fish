#!/usr/bin/env fish
# End-to-end alt text labeling workflow
# This script runs all 4 alt-text-llm commands in sequence

echo "🔍 Step 1: Scanning for images without alt text..."
alt-text-llm scan
if test $status -ne 0
    echo "❌ Scan failed"
    exit 1
end

echo ""
echo "🤖 Step 2: Generating alt text suggestions..."
alt-text-llm generate --model "gemini-3.1-flash-lite"
if test $status -ne 0
    echo "❌ Generation failed"
    exit 1
end

echo ""
echo "✏️  Step 3: Interactive labeling (review and edit suggestions)..."
alt-text-llm label --vi
if test $status -ne 0
    echo "❌ Labeling failed"
    exit 1
end

echo ""
read -P "Continue to apply alt text to markdown files? [y/N] " -l response
if test "$response" != y -a "$response" != Y
    echo "⏸️  Stopped. Run 'alt-text-llm apply' manually when ready."
    exit 0
end

echo ""
echo "📝 Step 4: Applying finalized alt text to markdown files..."
alt-text-llm apply
if test $status -ne 0
    echo "❌ Apply failed"
    exit 1
end

echo "✅ Alt text labeling workflow complete!"

