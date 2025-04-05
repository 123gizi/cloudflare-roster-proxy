FROM node:slim
RUN useradd -m appuser
WORKDIR /home/appuser/app
ADD https://github.com/123gizi/cloudflare-roster-proxy/raw/refs/heads/main/server.js ./server.js
ADD https://github.com/123gizi/cloudflare-roster-proxy/raw/refs/heads/main/html_home.html ./html_home.html
ADD https://github.com/123gizi/cloudflare-roster-proxy/raw/refs/heads/main/html_denied.html ./html_denied.html
RUN chown -R appuser:appuser /home/appuser/app
USER appuser
EXPOSE 5275
CMD ["node", "server.js"]