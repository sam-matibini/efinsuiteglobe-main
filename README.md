# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## CRA Tax & Remittance connection

The Tax & CRA screens keep an organization ledger in the browser. Filing, balance refresh, and payment release go through `POST /api/cra-gateway` on the same host. In development that route is the Vite server. On eFinsuite it is a Vercel function, `api/cra-gateway.js`, bundled from `server/craGatewayHandler.ts` by `scripts/bundle-cra-gateway.mjs`. Both call the same handler. The `cra-gateway` Supabase function is the same handler for a direct Supabase deploy.

Nothing is marked accepted or paid unless the external service says so:

- EFILE transmit posts GST34, PD7A, or T2 XML to `CRA_EFILE_TRANSMIT_URL` with the firm's EFILE software number and password. The address must be https on `gc.ca` or `canada.ca`. HTTP 200 without a confirmation number stays unaccepted.
- Status checks use `CRA_EFILE_STATUS_URL` and do not post the return again.
- Refresh calls `CRA_CDE_URL` and includes the saved representative name, representative ID, EFILE name, email, mailing address, and telephone. When that setting is empty, the gateway uses the CRA Internet File Transfer application at `https://apps.cra-arc.gc.ca/ebci/njfs/ext/disclaimer`. That application returns HTTP 401 for HTTP Basic authentication, so the gateway does not send the EFILE password to it. A certification-kit enquiry address still uses the firm EFILE number and password. Balances and the connected flag change only when the response includes account data. An Internet File Transfer page without account data leaves the amounts unchanged.
- EFILE transmit puts the EFILE name in the transmitter name and the representative name, email, mailing address, and telephone with the representative ID.
- Release opens a Nomba Checkout limited to cards. The payment stays authorized until Nomba confirms a Visa or Mastercard charge. Creating the checkout link does not mark it paid.

A platform admin can save the firm representative name, representative ID, EFILE name, EFILE number, EFILE password, email, mailing address, and telephone in Admin → Tax & CRA. Those saved values are used for filing, Client Data Enquiry, and remittances. The representative name is the name on the CRA Rep ID. The EFILE name is the name registered with the EFILE number. The email, mailing address, and telephone are the contact CRA has for this representative. Leave a field blank there to keep using the server value below. Do not put a client's CRA password in any of them.

```
CRA_REPRESENTATIVE_NAME=
CRA_REPRESENTATIVE_ID=
CRA_EFILE_NAME=
CRA_EFILE_NUMBER=
CRA_EFILE_PASSWORD=
CRA_CONTACT_EMAIL=
CRA_MAILING_ADDRESS=
CRA_TELEPHONE=
CRA_EFILE_TRANSMIT_URL=
CRA_EFILE_STATUS_URL=
CRA_CDE_URL=
NOMBA_CLIENT_ID=
NOMBA_CLIENT_SECRET=
NOMBA_ACCOUNT_ID=
NOMBA_ENVIRONMENT=live
NOMBA_CALLBACK_URL=
NOMBA_CURRENCY=CAD
```

`NOMBA_ENVIRONMENT=live` uses `https://api.nomba.com`. Any other value uses `https://sandbox.nomba.com`. This Nomba account charges CAD, so leave `NOMBA_CURRENCY=CAD`. Card numbers are entered on Nomba's page, not in eFinsuite. On this desktop, put the live client ID, client secret, and account ID in `Nomba Live Keys.txt` and press Save Nomba Keys. Those values are read by the dev gateway and are not committed.

CRA does not publish a public transmit or Client Data Enquiry URL. An EFILE number and password, issued when the firm registers for EFILE, are not enough by themselves. Leave the three CRA URLs empty until the certification kit provides them. The app then fails closed and names the missing setting. On this desktop, put the number, password, and those addresses in `CRA EFILE.txt` and press Save CRA EFILE. The dev gateway reads that file on each request. The password is not committed and is not shown in the app.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
