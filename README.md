# cloudflare-roster-proxy
This is to be used as a Cloudflare Worker to process and filter ICS link specifically used at my workplace.

Cloudflare Workers offers free service for up to 100,000 requests per day. All you need to set it up is a free Cloudflare account.
Here's the step-by-step process for creating a proxy. It takes only a few minutes and requires no tech know-how or prior experience.

# Step 1: Sign up for a free Cloudflare account if you don't have an account already
You can use an existing domain name you own or purchase a new one from any number of domain name providers such as godaddy.com.au or crazydomains.com.au

# Step 2: Create a worker
In your Cloudflare account, click on the 'Workers & Pages' section in the sidebar to get the 'Overview' page. On the top right of the 'Overview' page, click on the 'Create application' button. On the 'Create an application' page click on the 'Create Worker' button in the 'Workers' tab to start configuring your proxy.
Then click on the 'Deploy' button.

# Step 3: Paste the code from the worker.js file in this repository
Next click on the 'Edit Code' button, remove the default code that Cloudflare presents and paste the code that from this repository instead.
Click Save and Deploy

# Step 4: You can change the URL of your worker or assign a custom domain as required.

Good Luck!
