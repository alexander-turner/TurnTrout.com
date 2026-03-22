FROM mcr.microsoft.com/playwright:v1.58.2-noble

# Pre-install ffmpeg at the version pinned in CI so the setup step is instant
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg=7:6.1.1-3ubuntu5 \
    && rm -rf /var/lib/apt/lists/*
