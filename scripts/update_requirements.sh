#!/bin/bash
# Automatically update requirements.in and requirements.txt based on actual code usage

set -e

cd "$(dirname "$0")/.."

echo "Scanning scripts/ for dependencies..."

# Generate requirements.in from actual code usage
pipreqs scripts/ --force --savepath requirements.in

# Clean up the generated file to make it more readable
cat > requirements.in << 'EOF'
# Auto-generated from actual code usage in scripts/
# To regenerate: ./scripts/update_requirements.sh

# Production dependencies (auto-detected from scripts/)
EOF

# Extract just the package names (remove version pins) and sort them
pipreqs scripts/ --print 2>/dev/null | \
  grep -v "^INFO:" | \
  grep -v "^WARNING:" | \
  sed 's/==.*//' | \
  sed 's/^ruamel\.base$/ruamel.yaml/' | \
  sort -u | \
  grep -v "^$" >> requirements.in

# Add testing and development dependencies
cat >> requirements.in << 'EOF'

# Testing dependencies
pytest

# Type stubs for mypy
types-defusedxml
types-pyyaml
types-requests
pandas-stubs
EOF

echo "Generated requirements.in"

# Generate pinned requirements.txt using pip-compile
# Use --resolver=backtracking to avoid pip-tools 7.5.x bug with pip 24.x
echo "Compiling requirements.txt with pinned versions..."
pip-compile --resolver=backtracking requirements.in

echo "Requirements files updated successfully!"
echo "- requirements.in: high-level dependencies"
echo "- requirements.txt: pinned versions for reproducible builds"
