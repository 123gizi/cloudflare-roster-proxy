addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
  const html_header = '<!DOCTYPE html> <head> <title>Roster Domain - WIP</title> <link rel="icon" href="data:"> <style type="text/css"> body { background-color: #f0f0f2; margin: 0; padding: 0; font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;} #main { width: 600px; margin: 5em auto; padding: 2em; background-color: #fdfdff; border-radius: 0.5em; box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);} a:link, a:visited { color: #38488f; text-decoration: none;} @media (max-width: 700px) { div { margin: 0 auto; width: auto;}} </style> </head>';
  const init_default = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
      },
    };
  const init_approved = {
    headers: {
      "content-type": "text/calendar; charset=UTF-8",
      "connection": "close",
    },
    method: "GET"
  };
  const init_denied = {
    headers: {
      "content-type": "text/html; charset=UTF-8",
      "status": "403",
    },
  };
  const html_content = html_header + `
    <body>
      <div id="main">
        <h1>Welcome</h1>
        <p>If you paste the external link provided by Air Maestro and click "Generate",<br>you will see the full link that you require for use in this <a href="https://github.com/123gizi/GAS-ICS-Sync" target="_blank">Google Apps Script</a>.</p>
        <form id="myform">
          <label for="amLink">Air Maestro External Link:</label><br>
          <input type="text" id="amLink" name="amLink"><br><br>
          <button type="button" id="myButton">Generate</button>
        </form><br>
        <div id="gerneratedLink" style="word-wrap: anywhere"></div>
        <script>
          let text = document.getElementById('gerneratedLink');
          myButton.onclick = function(){
            text.textContent = window.location.toString() + "?url=" + document.getElementById('amLink').value;
          };
        </script>
      </div>
    </body>`;
  const html_denied = html_header + `
    <body>
      <div id="main">
        <h1>Action Not Allowed</h1>
        <p>The URL entered does not meet the requirements of this server.<br>Please check the URL entered and try again.<br><br>If you're still having issues, please consult your local company geek for assistance.</p>
      </div>
    </body>`;

  const { searchParams } = new URL(request.url);
  let targetUrl = searchParams.get('url');
  //console.log(targetUrl);
  if (targetUrl != null ){
    if (targetUrl.startsWith('webcals://')) {
      targetUrl = 'https://' + targetUrl.slice('webcals://'.length);
    }
    const allowed = 'airmaestro.cobhamspecialmission.com.au';
    let approvedUrl = targetUrl;
    if (approvedUrl.startsWith(allowed, 8)) {
      approvedUrl = targetUrl;
      //Unsure if Headers for fetch do anything
      //let response = await fetch(approvedUrl, init_approved);
      let response = await fetch(approvedUrl);
      let { readable, writable } = new TransformStream();
      streamBody(response.body, writable);

      return new Response(readable, response);

    } else {
      return new Response(html_denied, init_denied);
      }
  } else {
    return new Response(html_content, init_default);
  }
}

async function streamBody(readable, writable) {
  let reader = readable.getReader()
  let writer = writable.getWriter()
  const decoder = new TextDecoder('utf-8')
  const encoder = new TextEncoder('utf-8')

  let newDate = new Date(Date.now());
  //console.log(`${newDate.toDateString()} ${newDate.toTimeString()}`);

  let body = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    body += decoder.decode(value)
  }
  
  body = body.replace("VERSION:2.0", "VERSION:2.0\nX-WR-CALNAME:Air Maestro")
  body = body.replaceAll("Custom Fields:", "Custom Fields: Last Checked @ " + newDate)
  
  //Regex used to replace all TZIDs with Etc/UTC to correct for time abnormalities within AM
  body = body.replace(/(?<=;TZID=).*?(?=:)/sgm, "Etc/UTC")
  //body = body.replaceAll("TZID=Australia/Darwin", "TZID=Etc/UTC")

  await writer.write(encoder.encode(body))
  await writer.close()
}
