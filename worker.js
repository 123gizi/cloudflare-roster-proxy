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
    let overlapParams = searchParams.get('overlap'); //Do you want your shift to overlay with the duty rostered?
    let newDate = new Date(Date.now());
    console.log(`${newDate.toDateString()} ${newDate.toTimeString()} - ${targetUrl} - overlap=${overlapParams}`);

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
        let response = await fetch(approvedUrl, init_approved);
        //let response = await fetch(approvedUrl);
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

    //Regex used to replace all TZIDs with Etc/UTC to correct for time abnormalities within AM
    body = body.replace(/(?<=;TZID=).*?(?=:)/gms, "Etc/UTC")

    //Filter to remove some duplicate roster events - yet to be incorporated below
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*SAPL[\s\S]+?END:VEVENT/g, "")
    body = body.replace(/BEGIN:VEVENT([\s\S](?!BEGIN:VEVENT))+?SUMMARY:.*STBY[\s\S]+?END:VEVENT/g, "")

    // Extract the header (everything before the first "BEGIN:VEVENT")
    const header = body.split("BEGIN:VEVENT")[0];

    // Array to store modified events. Used to preserve event order purely for easy before/after text comparison
    const modifiedEvents = [];

    // Split the data by events
    const events = body.split("END:VEVENT");
    events.pop(); // Remove the last element which is an empty string

    // Process each event while keeping the original event order
    events.forEach((eventData) => {
      // Extract start/end times for later processing
      const dtstartMatch = eventData.match(/DTSTART;TZID=Etc\/UTC:(\d{8}T\d{6})/);
      const dtendMatch = eventData.match(/DTEND;TZID=Etc\/UTC:(\d{8}T\d{6})/);

      if (dtstartMatch && dtendMatch) {
        const dtstart = new Date(dtstartMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));
        const dtend = new Date(dtendMatch[1].replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'));

        // Remove duplicate roster events - Skip adding these events to modifiedEvents
        if (eventData.includes("SUMMARY:STANDBY") || eventData.includes("SUMMARY:ADM - Administration") || eventData.includes("SUMMARY:CARERS LEAVE") || eventData.includes("DESCRIPTION:RDO - ABF") || eventData.includes("DESCRIPTION:LDO - ABF") || eventData.includes("DESCRIPTION:ALV - ABF") || eventData.includes("DESCRIPTION:SICK - ABF") || eventData.includes("DESCRIPTION:CAO 48 LIM") || eventData.includes("DESCRIPTION:MLV - ABF") || eventData.includes("DESCRIPTION:BLV - ABF") || eventData.includes("DESCRIPTION:DFRLV - ABF") || eventData.includes("DESCRIPTION:LSL - ABF") || eventData.includes("DESCRIPTION:LWOP - ABF") || eventData.includes("DESCRIPTION:WCOMP - ABF") || eventData.includes("DESCRIPTION:LVR - ABF") || eventData.includes("DESCRIPTION:DDO - ABF") || eventData.includes("DESCRIPTION:DIL - ABF") || eventData.includes("DESCRIPTION:LWOP - ABF")) {
          return;
        }

        // Truncate common event names
        let modifiedEventData = eventData.replace(/SUMMARY:RDO - Rostered Day Off/g, "SUMMARY:RDO")
            .replace(/SUMMARY:DDO - Destination Day Off/g, "SUMMARY:DDO")
            .replace(/SUMMARY:LDO - Locked-in Day Off/g, "SUMMARY:LDO")
            .replace(/SUMMARY:ALV - Annual Leave/g, "SUMMARY:Annual Leave")
            .replace(/SUMMARY:ABFS - STANDBY/g, "SUMMARY:Standby")
            .replace(/SUMMARY:SICK - Sick Leave/g, "SUMMARY:Sick Leave");

        // Remove overlapping roster events (keep Travel without flight bookings) - Skip adding these events to modifiedEvents
        if (eventData.includes("DESCRIPTION: ABF - ABF") && overlapParams == "false" || eventData.includes("DESCRIPTION: TVL - Travel") && overlapParams == "false") {
          return;
        }

        // Modify past and future flight events to start 2 hours earlier and finish 30 minutes later - reflect general sign-on times
        if (eventData.includes("DESCRIPTION:ABF - Planned") && overlapParams == "false" || eventData.includes("DESCRIPTION:ABF - Partial") && overlapParams == "false" || eventData.includes("DESCRIPTION:ABF - Complete") && overlapParams == "false") {
          dtstart.setHours(dtstart.getHours() - 2);
          dtend.setMinutes(dtend.getMinutes() + 30);
          const modifiedDtstart = dtstart.toISOString().replace(/[:\-]|\.\d{3}Z/g, '');
          const modifiedDtend = dtend.toISOString().replace(/[:\-]|\.\d{3}Z/g, '');
          modifiedEventData = modifiedEventData.replace(dtstartMatch[1], modifiedDtstart).replace(dtendMatch[1], modifiedDtend);
          modifiedEvents.push(modifiedEventData + "END:VEVENT");
        }
        // Change events longer than 23 hours to be All Day events based on end date
        else if ((dtend - dtstart) > 23 * 60 * 60 * 1000) {
          const allDayDate = dtend.toISOString().split('T')[0].replace(/-/g, '');
          modifiedEventData = modifiedEventData.replace(/DTSTART;TZID=Etc\/UTC:[^;\n]*/, `DTSTART;VALUE=DATE:${allDayDate}`)
              .replace(/DTEND;TZID=Etc\/UTC:[^;\n]*/, '');
          modifiedEvents.push(modifiedEventData + "END:VEVENT");
        }
        // Preserve all other events
        else {
          modifiedEvents.push(modifiedEventData + "END:VEVENT");
        }
      }
    });

    // Combine the header, footer, and modified event data
    const modifiedFileContent =  header + modifiedEvents + "\nEND:VCALENDAR";

    // Remove any blank lines
    //const finalFileContent = modifiedFileContent.replace(/^\s*\n/gm, "");
    body = modifiedFileContent
    //Remove additional spaces left over after AM removes unauthorised data for user
    body = body.replace(/\\n\\n\\n\\n\\n/gms, "\\n\\n")
    body = body.replace(/&nbsp\\;/gms, " ")
    body = body.replace(/END:VEVENT,/g, "END:VEVENT")

    await writer.write(encoder.encode(body))
    await writer.close()

  }
  },
};
