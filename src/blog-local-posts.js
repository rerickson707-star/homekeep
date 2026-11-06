// Blog posts that live in the code instead of Sanity. App.jsx merges them into the blog index, each post page,
// the pre-rendered pages and the offline fallback, and api/sitemap.js lists them. A post with the same slug in
// Sanity wins, so a post can be moved to Sanity later without a code change.
//
// Fields: slug, title, description (about 150 characters), tag, time, date (shown), iso (YYYY-MM-DD, published),
// modified (YYYY-MM-DD), image ("" uses the default social image), content (HTML: h2, h3, p, ul, ol, a, strong).
// Put the FAQ under an h2 named "Frequently asked questions", one h3 per question, so it feeds the FAQ data.

export const BLOG_LOCAL_POSTS = [
  {
    slug: "how-to-look-up-appliance-warranty",
    title: "How to Look Up an Appliance Warranty",
    description: "How to check whether an appliance is still under warranty: find the model and serial number, prove the purchase date, and contact the manufacturer.",
    tag: "Appliances",
    time: "5 min read",
    date: "November 2026",
    iso: "2026-11-06",
    modified: "2026-11-06",
    image: "",
    // Manufacturer lookups below were checked on the manufacturers' own pages on 2026-11-06. Re-check before adding more brands.
    content: `
      <p>To check whether an appliance is still under warranty, you need three things: the model number, the serial number, and the date you bought it (or the date it was installed). With those, you can use the manufacturer's official support page or call its customer service to confirm what is covered and for how long.</p>
      <p>Warranty terms differ by brand, by product, and sometimes by part, so always confirm against your own warranty document or with the manufacturer.</p>

      <h2>Step 1: Find the model and serial number</h2>
      <p>Both numbers are usually printed on a rating plate or nameplate. Where it sits depends on the appliance and the brand: inside a door frame, on the back or side, or inside a lid. Our guide to <a href="/blog/find-appliance-serial-number">finding an appliance's serial number</a> shows where to look for each type.</p>
      <p>Take a clear photo of the plate. You will need it again for service calls and parts orders.</p>

      <h2>Step 2: Find your proof of purchase</h2>
      <p>Many manufacturer warranties run from the date of purchase. Whirlpool, for example, says its limited warranty typically lasts a year from the date of purchase, with the length depending on the appliance. For a new-construction home the start date can depend on how the builder sets it, so ask the builder. Look for:</p>
      <ul>
        <li>The store receipt or order confirmation email</li>
        <li>Credit card or bank statements showing the purchase</li>
        <li>The retailer's online purchase history</li>
        <li>Your closing documents and the builder's appliance list, for a new home</li>
        <li>A registration confirmation from the manufacturer, if you registered the product</li>
      </ul>

      <h2>Step 3: Check with the manufacturer</h2>
      <p>Search for the brand name plus "warranty" and go to the manufacturer's official website, or call its customer service number. Some manufacturers let you look up coverage online. These are the ones we confirmed on their own pages on November 6, 2026:</p>
      <ul>
        <li><strong>Carrier.</strong> Its <a href="https://www.carrier.com/us/en/residential/homeowner-resources/warranty-lookup/" target="_blank" rel="noopener noreferrer">warranty lookup</a> takes a serial number and shows each coverage with its description, length and end date. Carrier notes that the results show general parts warranties only and that other warranties tied to your record may differ.</li>
        <li><strong>Lennox.</strong> Its <a href="https://www.lennox.com/residential/owners/assistance/warranty/" target="_blank" rel="noopener noreferrer">warranty lookup</a> takes the serial number from the equipment label and shows your product's coverage. If nothing comes up, it suggests contacting your installing dealer.</li>
        <li><strong>Rheem.</strong> Its <a href="https://rheem.com/warranty" target="_blank" rel="noopener noreferrer">warranty page</a> says your serial number is required to verify warranty terms and coverage.</li>
        <li><strong>Whirlpool.</strong> Its <a href="https://producthelp.whirlpool.com/FAQ/Is_My_Appliance_in_Warranty%3F" target="_blank" rel="noopener noreferrer">warranty help page</a> says to use your model number to find the warranty information in its Owner's Center. Your owner's manual also lists the warranty terms.</li>
      </ul>
      <p>Not every brand has an online lookup, and these pages change, so treat this list as a starting point. Stick to the manufacturer's own site or phone line, and be cautious with third-party "warranty lookup" sites that ask for payment or personal information. When you contact the manufacturer, have ready the model number, serial number, purchase date, and a description of any problem.</p>

      <h2>What manufacturer warranties usually cover</h2>
      <p>Terms vary by brand and product, and some brands cover specific parts for longer than the rest of the appliance. Warranties typically exclude damage from misuse, improper installation, and normal wear. Your warranty document spells out the exact terms. If you no longer have it, ask the manufacturer for a copy.</p>

      <h2>What if you have no receipt?</h2>
      <p>Start with the retailer's purchase history, your card statements, or the builder's closing paperwork. If none of these exist, contact the manufacturer and ask what proof it accepts. Policies differ, so ask before you assume.</p>

      <h2>Manufacturer warranty vs. home warranty</h2>
      <p>A manufacturer warranty comes with the product and covers defects in that product for a set period. A home warranty is a separate service contract you pay for, and it covers repair or replacement of certain systems and appliances. Our guide to <a href="/blog/what-does-a-home-warranty-cover">what a home warranty covers</a> explains the difference.</p>

      <h2>Keep your warranties in one place with Steadwell</h2>
      <p>Warranty paperwork is easy to lose, and you usually need it at the worst time. Steadwell's <a href="/warranty-tracker">warranty tracker</a> is free on every plan. You enter each appliance's brand, model, serial number, purchase date and warranty length, and Steadwell emails you before the warranty ends and checks the item against federal recalls.</p>
      <p>On Plus and Pro, <a href="/ai-scan">AI scanning</a> can read a receipt or appliance nameplate and fill in the record for you to review. Smart Fill can take a model number and suggest the typical warranty length from public data. That suggestion is a starting point, not a coverage check, so confirm the real terms with the manufacturer or your warranty document.</p>

      <h2>Frequently asked questions</h2>
      <h3>How do I check if my appliance is still under warranty?</h3>
      <p>Find the model and serial number on the appliance's rating plate, find your purchase date, and contact the manufacturer or use the support page on its official website.</p>
      <h3>Can I look up a warranty by serial number?</h3>
      <p>Some manufacturers offer it. Carrier and Lennox have online lookups that take a serial number, and Rheem says a serial number is required to verify its warranties. Others, like Whirlpool, point you to the model number and the owner's manual. Check the manufacturer's own site for your brand.</p>
      <h3>Does a warranty start when I buy the appliance or when it was made?</h3>
      <p>Many start on the purchase date. Whirlpool, for example, says its limited warranty typically lasts a year from the date of purchase. Check your warranty document for the exact start date.</p>
      <h3>Do I need the receipt to make a warranty claim?</h3>
      <p>Often yes, as proof of purchase. If you lost it, try the retailer's purchase history, card statements, or builder closing documents, and ask the manufacturer what else it accepts.</p>
      <h3>Where is the serial number on an appliance?</h3>
      <p>On the rating plate or nameplate. Its location varies by appliance and brand. See our <a href="/blog/find-appliance-serial-number">serial number guide</a>.</p>
      <h3>Is a home warranty the same as a manufacturer warranty?</h3>
      <p>No. A manufacturer warranty covers defects in a specific product. A home warranty is a paid service contract that covers repair or replacement of certain home systems and appliances.</p>
    `,
  },
  {
    slug: "rental-property-maintenance-checklist",
    title: "Rental Property Maintenance Checklist: Seasonal and Turnover Tasks",
    description: "A practical rental property maintenance checklist: seasonal tasks, a turnover walkthrough, and the records to keep for every property you manage.",
    tag: "Maintenance",
    time: "7 min read",
    date: "October 2026",
    iso: "2026-10-28",
    modified: "2026-10-28",
    image: "",
    content: `
      <h2>Why a rental needs its own checklist</h2>
      <p>A home you live in tells you when something is wrong. You hear the drip and feel the draft. A rental doesn't. Small problems sit until they are expensive, and the person who notices them is often not the person who pays for them. A written checklist, run on a schedule and at every turnover, replaces noticing with a routine.</p>
      <p>This checklist is general guidance for typical single-family rentals and small buildings. Climate, local codes and your lease change the details, and the rules for entering a rental and handling repairs vary by state. Read our <a href="/blog/landlord-property-maintenance-tracking">landlord's guide to maintenance tracking and state rules</a> before you schedule inspections.</p>

      <h2>The routine tasks that never change</h2>
      <p><strong>Every month:</strong> check the HVAC air filter. ENERGY STAR advises checking the filter monthly and cleaning or replacing it when it is dirty. Test every smoke alarm; the National Fire Protection Association (NFPA) recommends testing monthly. If your tenants handle these, put the task in the lease and confirm it at each visit.</p>
      <p><strong>Every year:</strong> have a professional service the heating and cooling equipment. ENERGY STAR suggests booking the cooling checkup in spring and the heating checkup in fall, before contractors get busy. See our <a href="/blog/hvac-maintenance-schedule">HVAC maintenance schedule</a> for what a good visit covers.</p>

      <h2>Seasonal checklist</h2>
      <h3>Spring</h3>
      <ul>
        <li>Book the cooling-system tune-up before the first hot week.</li>
        <li>Look over the roof from the ground for missing, curled or damaged shingles and for loose flashing.</li>
        <li>Clean gutters and confirm each downspout drains away from the foundation.</li>
        <li>Check exterior caulk, door and window seals, and screens.</li>
        <li>Turn on outdoor faucets and irrigation and look for leaks.</li>
        <li>Inspect decks, railings and steps for soft spots or loose fasteners.</li>
      </ul>
      <h3>Summer</h3>
      <ul>
        <li>Check that the air conditioner's condensate line drains freely.</li>
        <li>Look under every sink and around each toilet and the water heater for slow leaks.</li>
        <li>Trim plants back from the house and the outdoor AC unit.</li>
        <li>Walk the exterior and garage for signs of pests.</li>
      </ul>
      <h3>Fall</h3>
      <ul>
        <li>Book the heating-system tune-up and replace filters.</li>
        <li>Clean gutters again after the leaves come down.</li>
        <li>Test smoke and carbon monoxide alarms and replace batteries where the model uses them.</li>
        <li>Check weatherstripping and seal gaps around doors and windows.</li>
        <li>Have a wood-burning fireplace or chimney inspected before it is used.</li>
      </ul>
      <h3>Winter</h3>
      <ul>
        <li>Make sure your tenant knows where the main water shutoff is.</li>
        <li>Check pipes in unheated spaces such as crawlspaces, garages and exterior walls.</li>
        <li>Confirm heat works in every room.</li>
        <li>After storms, look for roof leaks, ice damage and fallen limbs.</li>
      </ul>

      <h2>Turnover checklist: between tenants</h2>
      <p>The days between tenants are your best chance to see everything. Work through the same list every time so nothing depends on memory.</p>
      <ol>
        <li><strong>Document the condition.</strong> Take dated photos of every room, appliance and any damage, and compare them with the move-in photos. Rules for deposit deductions and deadlines differ by state, and photos and receipts are what back up your numbers.</li>
        <li><strong>Test every appliance.</strong> Run the oven, range, dishwasher, disposal, refrigerator and any washer or dryer you provide. Record the model and serial number of each.</li>
        <li><strong>Check for water.</strong> Run every faucet and shower, flush toilets, look under sinks and check ceilings below bathrooms.</li>
        <li><strong>Check the safety devices.</strong> Test smoke and carbon monoxide alarms. NFPA recommends replacing smoke alarms every 10 years, and carbon monoxide alarms last a set number of years that depends on the model (often 7 to 10). The manufacture or replace-by date is printed on the back.</li>
        <li><strong>Reset the HVAC.</strong> Replace the filter and confirm both heating and cooling run.</li>
        <li><strong>Secure the property.</strong> Rekey or replace locks and collect every key, fob and garage remote.</li>
        <li><strong>Test the GFCI outlets</strong> in kitchens, bathrooms and outdoors with the test button.</li>
        <li><strong>Check windows, screens and blinds.</strong></li>
        <li><strong>Touch up.</strong> Paint, caulk and repair flooring so the unit is ready to show.</li>
        <li><strong>Update your records.</strong> Note every repair, who did it and what it cost.</li>
      </ol>

      <h2>What to record for every property</h2>
      <p>The checklist only works if you can see what you have. For each property, keep:</p>
      <ul>
        <li>Brand, model, serial number and install date for every appliance and major system, such as the water heater, HVAC, roof and panel.</li>
        <li>Warranty end dates, so you file a claim before coverage lapses.</li>
        <li>Service history: the date, who did the work and what it cost.</li>
        <li>Practical details that save a trip: filter sizes, paint colors and where the main shutoffs are.</li>
        <li>Inspection reports, permits, manuals and receipts, filed with the property they belong to.</li>
      </ul>
      <p>Age is the most useful number on that list. It lets you replace a failing water heater on your schedule instead of in the middle of a tenancy. Good records also help at tax time. IRS Publication 527 covers rental property depreciation and which repair costs you can deduct.</p>

      <h2>How often should you inspect?</h2>
      <p>Many landlords do a quick look at the exterior and the inside once or twice a year, plus the turnover walkthrough. How often you may enter, and how much notice you must give, depends on your state and your lease, so confirm both first.</p>

      <h2>Keep it all in one place</h2>
      <p>Steadwell keeps a separate record for each property: appliances with their age and warranty, a recurring <a href="/home-maintenance-tracker">maintenance schedule</a>, <a href="/warranty-tracker">warranty reminders</a>, documents, contractors and costs. With <a href="/shared-household-access">shared access</a> you can invite your maintenance people, choose which properties each one sees and assign them tasks. Pro covers up to 3 properties, and if you manage more you can <a href="/property-managers">request multi-property access</a>.</p>

      <h2>Frequently asked questions</h2>
      <h3>How often should a landlord do maintenance on a rental property?</h3>
      <p>Routine tasks run monthly, such as filters and alarm tests, then seasonally for HVAC, gutters and the exterior, and then at every turnover. Add inspections as your lease and state law allow.</p>
      <h3>What should be on a rental turnover checklist?</h3>
      <p>Dated photos, an appliance test, a water check, safety devices, a fresh HVAC filter, new locks, GFCI tests, touch-ups and updated records.</p>
      <h3>How often should smoke alarms be replaced in a rental?</h3>
      <p>NFPA recommends replacing smoke alarms every 10 years and testing them monthly. Carbon monoxide alarms follow the manufacturer's lifespan, often 7 to 10 years. Check the date printed on the back of each unit.</p>
      <h3>Who is responsible for maintenance in a rental?</h3>
      <p>Generally the landlord keeps the property habitable and maintains major systems, and the tenant is responsible for damage they cause, but the exact split depends on the lease and your state's law. Our <a href="/blog/landlord-property-maintenance-tracking">landlord guide</a> covers how the rules vary by state.</p>
      <p><em>This article is general information, not legal or tax advice. Check current rules for your state and ask a professional about your situation.</em></p>
    `,
  },
];
