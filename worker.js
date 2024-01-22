import html_home from './html_home.html';
import html_denied from './html_denied.html';

export default {
  async fetch(request) {
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
      method: "GET",
      cf: { cacheTtl: 5 }
    };
    const init_denied = {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "status": "403",
      },
    };
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get('url');
    let newDate = new Date(Date.now());
    console.log(`${newDate.toDateString()} ${newDate.toTimeString()} - ${targetUrl}`);

    if (targetUrl != null ){
      if (targetUrl.startsWith('webcals://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('webcals://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('https://airmaestro.cobhamspecialmission.com.au')) {
        targetUrl = 'https://airmaestro.surveillanceaustralia' + targetUrl.slice('https://airmaestro.cobhamspecialmission'.length);
      } else if (targetUrl.startsWith('webcals://')) {
        targetUrl = 'https://' + targetUrl.slice('webcals://'.length);
      }
      const allowed = 'airmaestro.surveillanceaustralia.com.au';
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
      return new Response(html_home, init_default);
    }

  async function streamBody(readable, writable) {
    let reader = readable.getReader();
    let writer = writable.getWriter();
    const decoder = new TextDecoder('utf-8');
    const encoder = new TextEncoder('utf-8');

    //let newDate = new Date(Date.now());
    //console.log(`${newDate.toDateString()} ${newDate.toTimeString()}`);

    let body = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      body += decoder.decode(value)
    }

    //Adding a Name to the calendar and a suggested publish limit of no more than 1 hour
    body = body.replace("VERSION:2.0", "VERSION:2.0\nX-WR-CALNAME:Air Maestro\nX-PUBLISHED-TTL:PT1H")

    //Time logged for testing
    //body = body.replaceAll("Custom Fields:", "Custom Fields: Last Checked @ " + newDate)

    //Regex used to replace all TZIDs with Etc/UTC to correct for time abnormalities within AM
    body = body.replace(/(?<=;TZID=).*?(?=:)/gms, "Etc/UTC")

    //Filters to be used to remove some duplication of information inherent in AM
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:STANDBY[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:ADM - Administration[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:CARERS LEAVE[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*SAPL[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*STBY[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:RDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:ALV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:SICK - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:CAO 48 LIM[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:MLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:BLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DFRLV - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LSL - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LWOP - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:WCOMP - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LVR - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DDO - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:DIL - ABF[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?DESCRIPTION:LWOP - ABF[\s\S]+?END:VEVENT/g, "")

    //Remove additional spaces left over after AM removes unauthorised data for user
    body = body.replace(/\\n\\n\\n\\n\\n/gms, "\\n\\n")
    body = body.replace(/&nbsp\\;/gms, " ")

    await writer.write(encoder.encode(body))
    await writer.close()
  }
  },
};
