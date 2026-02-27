FROM node:slim
RUN useradd -m appuser
WORKDIR /home/appuser/app
COPY server.js ./server.js
COPY html_home.html ./html_home.html
COPY html_denied.html ./html_denied.html
COPY images/ ./images/
RUN chown -R appuser:appuser /home/appuser/app
USER appuser
EXPOSE 5275
CMD ["node", "server.js"]
