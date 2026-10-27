# QA browser image: Playwright (chromium, firefox, webkit) + pixelmatch, all INSIDE Docker (never a browser on the owner's machine).
# The pipeline itself stays dependency free; only this image carries npm packages.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /qa
RUN npm init -y >/dev/null && npm i --no-audit --no-fund playwright@1.64.1 pixelmatch@6 pngjs@7 sharp@0.33 >/dev/null
