// Blog posts that live in the code instead of Sanity. App.jsx merges them into the blog index, each post page,
// the pre-rendered pages and the offline fallback, and api/sitemap.js lists them. A post with the same slug in
// Sanity wins, so a post can be moved to Sanity later without a code change.
//
// Fields: slug, title, description (about 150 characters), tag, time, date (shown), iso (YYYY-MM-DD, published),
// modified (YYYY-MM-DD), image ("" uses the default social image), content (HTML: h2, h3, p, ul, ol, a, strong).
// Put the FAQ under an h2 named "Frequently asked questions", one h3 per question, so it feeds the FAQ data.

export const BLOG_LOCAL_POSTS = [
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
