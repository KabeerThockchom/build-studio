/**
 * Gallery of sample apps for the Build Studio workshop.
 *
 * Each card in the gallery represents a concrete one-day-buildable app idea.
 * Picking a card prefills the idea box with a realistic starter sentence
 * and carries the vertical's `industry` field silently into the SA prompt
 * to ground the generated code in real vertical-specific context.
 *
 * Structure: 4 verticals × 3 outcome columns × 3 sample apps = 36 total apps.
 * (Retail, Travel & Hospitality, QSR, and Beverage Distribution — the last
 * grounded in a Coca-Cola bottler's world for the CONA / Costa workshop.)
 * All `id` values are unique kebab-case slugs.
 */

export interface SampleApp {
  id: string;        // kebab-case slug, unique across the whole file
  label: string;     // the app name, e.g. "Store Slip Detector" — short, punchy, 2-4 words
  blurb: string;     // ONE plain sentence: what it does + who it helps. No hype, no adjectives like "powerful"/"seamless".
  starter: string;   // an editable first-person idea sentence the user could have typed themselves
  components: string[]; // default app pieces this sample pre-selects in Assemble; user can still tweak
  facets?: { problem: string; how: string; tool: string; objective: string }; // 4-bullet breakdown for workshop participants: the problem / how we solve it / what tool / what objective
}

export interface OutcomeColumn {
  outcome: string;         // business-outcome column header (a goal, not a feature)
  apps: SampleApp[];       // 3 apps per column
}

export interface GalleryVertical {
  id: string;              // "retail" | "travel" | "qsr"
  label: string;           // "Retail", "Travel & Hospitality", "Quick-Service Restaurants"
  industry: string;        // a short industry phrase carried silently into an AI prompt
  columns: OutcomeColumn[]; // exactly 3 columns per vertical
}

// Map a sample's app pieces to the interest chips on the Shape page, so picking a
// card lights up what shapes it. "Apps" is on nearly everything; an agent/assistant
// shape reads as "AI agents", otherwise a data-question shape reads as "Analytics & BI".
export function interestsForComponents(components: string[]): string[] {
  const out: string[] = [];
  if (components.includes("Supervisor agent") || components.includes("Knowledge Assistant")) out.push("AI agents");
  else if (components.includes("Genie")) out.push("Analytics & BI");
  if (components.includes("Databricks Apps")) out.push("Apps");
  return out;
}

export const GALLERY: GalleryVertical[] = [
  {
    id: "retail",
    label: "Retail",
    industry: "retail (stores + e-commerce)",
    columns: [
      {
        outcome: "Operations that run themselves",
        apps: [
          {
            id: "store-slip-detector",
            label: "Store Slip Detector",
            blurb: "Watches daily sales against targets and alerts managers when a location is underperforming.",
            starter: "Our store managers only find out a location is underperforming after the monthly report. Each morning, I want to check our daily sales against targets and see which stores are trending down so we can catch problems early. The tool reads our transaction data and sales targets for each store, and flags stores that are underperforming relative to their goals.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Managers find out about underperformance too late, after the monthly report",
              how: "Daily check of sales against targets, highlights which stores are trending down",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Catch problems early before they compound",
            },
          },
          {
            id: "inventory-rebalancer",
            label: "Inventory Rebalancer",
            blurb: "Suggests which stores are overstocked and which need replenishment based on current stock levels.",
            starter: "We have the inventory counts, but rebalancing between stores is manual and slow. Once a week, our supply chain team needs to redistribute stock across locations to avoid markdowns and stockouts. The tool reads current inventory counts by store and SKU, and suggests which locations have excess and which need replenishment, so the team can make faster transfer decisions.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Rebalancing stock between stores is manual and slow, causing markdowns or stockouts",
              how: "Suggests which stores are overstocked and which need replenishment based on current counts",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save decisions, and a Databricks App as the interface",
              objective: "Speed up transfers and avoid markdowns or stockouts",
            },
          },
          {
            id: "auto-tag-products",
            label: "Auto-Tag New Products",
            blurb: "Reads product details and suggests category tags and metadata for merchandisers to approve.",
            starter: "When we add new products, our merchandisers manually tag and categorize them, which slows down time-to-shelf. Each day when new SKUs arrive, the tool reads the product description, supplier category, and attributes, and suggests tags and metadata so the merchandisers can approve or edit in minutes instead of manually building them from scratch.",
            components: ["Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Merchandisers manually tag new products, slowing time-to-shelf",
              how: "Reads product details and suggests category tags and metadata for approval",
              tool: "Knowledge Assistant to read product details, an agent to tie the pieces together, Lakebase to save tags, and a Databricks App as the interface",
              objective: "Speed up time-to-shelf with automated tag suggestions",
            },
          },
        ],
      },
      {
        outcome: "Grow revenue per customer",
        apps: [
          {
            id: "smart-bundle-suggester",
            label: "Smart Bundle Suggester",
            blurb: "Analyzes purchase history to identify product combinations that sell together and suggests promotional bundles.",
            starter: "We know which products sell together, but we're running the same bundle promotions everywhere. Every quarter when we plan promotions, the tool reads our transaction history and identifies which products are frequently bought together, so we can create relevant bundles tailored to actual customer behavior instead of guessing.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Running same bundle promotions everywhere instead of tailored to actual customer behavior",
              how: "Analyzes purchase history to identify which products sell together",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save bundles, and a Databricks App as the interface",
              objective: "Create bundles based on actual customer behavior",
            },
          },
          {
            id: "shopper-segment-finder",
            label: "Shopper Segment Finder",
            blurb: "Groups customers by behavior and purchase patterns to help marketing tailor campaigns to each segment.",
            starter: "Our marketing team manually segments our shopper base before each campaign, which delays launches and feels outdated fast. The tool reads our transaction history and loyalty account data, identifies natural customer clusters by purchase frequency, spend, and category preferences, so marketing can send targeted campaigns to each group instead of one-size-fits-all blasts.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Marketing team manually segments shoppers before each campaign, delays launches",
              how: "Groups customers by behavior and purchase patterns into natural clusters",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Enable targeted campaigns instead of one-size-fits-all",
            },
          },
          {
            id: "price-optimization-spotter",
            label: "Price Optimization Spotter",
            blurb: "Identifies products that are priced too low or too high relative to demand and historical patterns.",
            starter: "We have historical price and sales data, but our pricing stays static even when demand shifts. Monthly, the tool reads our price history, sales volume, and competitor pricing, and flags items that are underpriced relative to demand or overpriced relative to sales, so we know where pricing room exists to improve margin.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Pricing stays static even when demand shifts",
              how: "Identifies products priced too low or too high relative to demand",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Identify pricing room to improve margin",
            },
          },
        ],
      },
      {
        outcome: "Run efficient supply chain",
        apps: [
          {
            id: "supplier-scorecard",
            label: "Supplier Performance Scorecard",
            blurb: "Tracks on-time delivery, quality, and lead times for each supplier to identify reliable vs. problematic partners.",
            starter: "We get shipments from many suppliers but I'm only looking at invoices to know how they're doing. Each week, the tool reads our purchase orders, receipt records, and invoice dates to track on-time delivery, quality issues, and lead times by supplier, so we can identify which partners are reliable and which need improvement or replacement.",
            components: ["Genie", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Only looking at invoices to assess supplier performance",
              how: "Tracks on-time delivery, quality, and lead times for each supplier",
              tool: "Genie to ask the data, Lakebase to save scorecards, and a Databricks App as the interface",
              objective: "Identify reliable vs problematic partners",
            },
          },
          {
            id: "demand-forecast-helper",
            label: "Demand Forecast Helper",
            blurb: "Analyzes historical sales to spot seasonal patterns and predict future demand for better inventory planning.",
            starter: "Every quarter we manually guess how much inventory to order, often ending up with too much or too little. The tool reads our historical sales data by product and season, identifies patterns and trends, and predicts demand for the next quarter so we can order the right quantities and reduce carrying costs and stockouts.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Manually guessing inventory orders each quarter, often ordering too much or too little",
              how: "Analyzes historical sales to spot seasonal patterns and predict future demand",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Order right quantities to reduce carrying costs and stockouts",
            },
          },
          {
            id: "return-reason-analyzer",
            label: "Return Reason Analyzer",
            blurb: "Groups returned items by reason to surface product or process issues affecting customer satisfaction.",
            starter: "We track returns but nobody connects them to root causes. Daily, the tool reads our return notes and invoice data, groups returns by reason (size, quality, color mismatch, etc.), and surfaces the top problems so we can prioritize what to fix to reduce returns and improve customer satisfaction.",
            components: ["Knowledge Assistant", "Genie", "Databricks Apps"],
            facets: {
              problem: "Track returns but don't connect them to root causes",
              how: "Groups returned items by reason to surface product or process issues",
              tool: "Knowledge Assistant to read return notes, Genie to ask the data, and a Databricks App as the interface",
              objective: "Reduce returns and improve customer satisfaction",
            },
          },
        ],
      },
    ],
  },
  {
    id: "travel",
    label: "Travel & Hospitality",
    industry: "travel and hospitality (hotels, resorts, tour operators)",
    columns: [
      {
        outcome: "Operations that run themselves",
        apps: [
          {
            id: "reservation-issue-responder",
            label: "Reservation Issue Responder",
            blurb: "Reads booking issues in guest emails and routes them to the right team or auto-resolves common problems.",
            starter: "Our reservation team gets flooded with guest emails about booking problems throughout the day. The tool reads incoming emails and our reservation database to identify the issue, auto-respond to common questions (date changes, room type clarifications), and route complex problems to the right person, so the team spends time on real issues instead of repetitive triage.",
            components: ["Knowledge Assistant", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Reservation team flooded with guest emails about booking problems",
              how: "Reads booking issues and auto-resolves common problems or routes to the right person",
              tool: "Knowledge Assistant to read emails, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Spend time on real issues instead of repetitive triage",
            },
          },
          {
            id: "revenue-manager-assistant",
            label: "Revenue Manager's Assistant",
            blurb: "Suggests rate adjustments based on occupancy, demand signals, and historical trends to optimize nightly revenue.",
            starter: "Our revenue manager adjusts room rates manually each day based on occupancy and intuition. Each morning, the tool reads current occupancy, historical rates, forward bookings, and competitor pricing, and shows rate recommendations for each room type so the manager can maximize nightly revenue with data-driven adjustments.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Revenue manager adjusts rates manually each day based on intuition",
              how: "Suggests rate adjustments based on occupancy, demand signals, and historical trends",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save recommendations, and a Databricks App as the interface",
              objective: "Maximize nightly revenue with data-driven adjustments",
            },
          },
          {
            id: "housekeeping-prioritizer",
            label: "Housekeeping Prioritizer",
            blurb: "Ranks rooms by priority based on checkout status, VIP guests, and recent complaints to guide daily cleaning order.",
            starter: "Housekeeping gets a list of rooms to clean but no priority, so they guess which to tackle first. Each morning, the tool reads checkout times, guest history, room type, complaints and special requests, and ranks rooms so VIP guests and high-complaint rooms get attention first, and rooms checking in soon are ready on time.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Housekeeping gets a list of rooms with no priority guidance",
              how: "Ranks rooms by priority based on checkout status, VIP guests, and complaints",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Ensure VIP rooms and high-complaint rooms get attention first",
            },
          },
        ],
      },
      {
        outcome: "Diversified Revenue Growth",
        apps: [
          {
            id: "upsell-recommendation-engine",
            label: "Upsell Recommendation Engine",
            blurb: "Suggests relevant add-on services like spa, dining packages, or activities based on each guest's profile.",
            starter: "We're leaving money on the table. When a guest books a room or arrives at check-in, we don't suggest relevant extras. The tool reads the reservation, guest history, prior stays, and current events, and recommends spa packages, dining experiences, or activities that match the guest profile, so we can increase ancillary revenue without feeling pushy.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Not suggesting relevant extras at booking or check-in",
              how: "Suggests add-on services based on each guest's profile and history",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Increase ancillary revenue per guest",
            },
          },
          {
            id: "event-space-optimizer",
            label: "Event Space Optimizer",
            blurb: "Identifies underutilized event spaces and time slots to suggest targeted promotions and fill gaps.",
            starter: "Our event planner knows which spaces are booked, but doesn't see the gaps. Weekly, the tool reads our event bookings and availability calendar and identifies low-booked time slots and spaces, so the planner can run targeted promotions to fill ballrooms on slow weekends or meeting spaces mid-week.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Event planner knows which spaces are booked but doesn't see gaps",
              how: "Identifies underutilized spaces and time slots",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save promotions, and a Databricks App as the interface",
              objective: "Fill gaps with targeted promotions",
            },
          },
          {
            id: "loyalty-tier-analyzer",
            label: "Loyalty Tier Analyzer",
            blurb: "Flags guests close to their next loyalty tier and suggests targeted incentive offers to drive upgrades.",
            starter: "We know which guests are close to upgrading their loyalty tier, but we're not reaching out proactively. Monthly, the tool reads our loyalty database and guest history, flags members within a few stays of the next tier, and suggests the best incentive (free night, room upgrade, dining credit) to nudge them to book again and qualify.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Guests close to next loyalty tier but not reaching out proactively",
              how: "Flags guests close to upgrading and suggests targeted incentive offers",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Drive tier upgrades and repeat visits",
            },
          },
        ],
      },
      {
        outcome: "Consumer at the Center",
        apps: [
          {
            id: "guest-feedback-categorizer",
            label: "Guest Feedback Categorizer",
            blurb: "Reads reviews and comments, groups them by theme (cleanliness, staff, amenities) to surface improvement areas.",
            starter: "We get hundreds of guest reviews but they're all in a pile. Weekly, the tool reads our review database, survey responses, and comment cards, groups feedback by theme (room quality, staff, food, amenities, etc.), and surfaces the top complaints so we know exactly what to prioritize fixing.",
            components: ["Knowledge Assistant", "Genie", "Databricks Apps"],
            facets: {
              problem: "Hundreds of guest reviews in a pile, no theme organization",
              how: "Reads reviews and groups them by theme to surface improvement areas",
              tool: "Knowledge Assistant to read reviews, Genie to ask the data, and a Databricks App as the interface",
              objective: "Know exactly what to prioritize fixing",
            },
          },
          {
            id: "personalized-experience-generator",
            label: "Personalized Experience Generator",
            blurb: "Reads past stays and guest history to flag preferences and anticipate needs for a personalized stay.",
            starter: "Our staff doesn't know that Mr. Johnson always orders coffee black at 7am or that the Rodriguez family has kids. At check-in, the tool reads the guest's stay history, preferences, dietary notes, and past room choices, and flags key details so staff can greet them warmly and anticipate needs without being asked.",
            components: ["Knowledge Assistant", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Staff doesn't know guest preferences and past requests",
              how: "Reads past stays and guest history to flag preferences",
              tool: "Knowledge Assistant to read guest history, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Anticipate needs and personalize check-in",
            },
          },
          {
            id: "complaint-early-responder",
            label: "Complaint Early Responder",
            blurb: "Monitors real-time guest feedback during their stay to flag issues early before they become negative reviews.",
            starter: "By the time we see a negative review, it's too late. During each guest's stay, the tool checks maintenance requests, service calls, and in-app comments and surfaces problems (broken AC, late checkout denied, rude staff comment) so a manager can reach out and fix it before checkout, turning a bad stay into a recovery win.",
            components: ["Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Only see negative reviews after checkout, too late to fix",
              how: "Monitors real-time guest feedback during stay to flag issues early",
              tool: "Knowledge Assistant to read feedback, an agent to tie the pieces together, Lakebase to save responses, and a Databricks App as the interface",
              objective: "Turn bad stays into recovery wins before checkout",
            },
          },
        ],
      },
    ],
  },
  {
    id: "qsr",
    label: "Quick-Service Restaurants",
    industry: "quick-service restaurants (QSR, limited-service chains)",
    columns: [
      {
        outcome: "Operations that run themselves",
        apps: [
          {
            id: "crew-schedule-optimizer",
            label: "Crew Schedule Optimizer",
            blurb: "Suggests staffing levels based on predicted traffic and historical traffic patterns to balance coverage and costs.",
            starter: "We manually schedule crew based on guesses about how busy we'll be, often over-staffing slow shifts or under-staffing peaks. Weekly, the tool reads our historical transaction and labor data and predicts traffic by time of day and day of week, so we can suggest optimal crew counts for each shift and reduce labor costs without hurting service.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Manually scheduling crew based on guesses, often over/under-staffing",
              how: "Suggests staffing levels based on predicted traffic and historical patterns",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save schedules, and a Databricks App as the interface",
              objective: "Balance coverage and labor costs",
            },
          },
          {
            id: "inventory-depletion-alerter",
            label: "Inventory Depletion Alerter",
            blurb: "Flags items running low in real-time so managers can reorder before stockouts disrupt service.",
            starter: "We run out of popular items because we don't notice until too late. Each shift, the tool reads our point-of-sale data and inventory counts, predicts which items will run out based on usage, and alerts the manager so they can reorder before stockouts hurt sales and customer satisfaction.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Run out of popular items because we don't notice until too late",
              how: "Flags items running low in real-time based on predicted usage",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Prevent stockouts that hurt sales",
            },
          },
          {
            id: "equipment-maintenance-scheduler",
            label: "Equipment Maintenance Scheduler",
            blurb: "Predicts when equipment needs service based on usage patterns to prevent unexpected breakdowns.",
            starter: "Our fryer or ice cream machine breaks unexpectedly during peak hours and loses us time and sales. Daily, the tool reads our equipment usage logs and maintenance history to predict when each piece needs service, so we can schedule maintenance during downtime and avoid breakdowns that kill revenue.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Equipment breaks unexpectedly during peak hours, loses time and sales",
              how: "Predicts when equipment needs service based on usage patterns",
              tool: "Genie to ask the data, an agent to tie the pieces together, Lakebase to save schedules, and a Databricks App as the interface",
              objective: "Prevent breakdowns that kill revenue",
            },
          },
        ],
      },
      {
        outcome: "Drive guest loyalty",
        apps: [
          {
            id: "personalized-offer-builder",
            label: "Personalized Offer Builder",
            blurb: "Suggests relevant menu items or promotions for each customer segment to increase order values and repeat visits.",
            starter: "We send the same promotions to everyone. When a customer orders or opens the app, the tool reads their purchase history and segment profile, and suggests personalized menu items or offers (combo deals, new items they'd like, loyalty rewards) so we increase order value and bring them back more often.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Sending same promotions to everyone",
              how: "Suggests relevant menu items or promotions for each customer segment",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Increase order values and repeat visits",
            },
          },
          {
            id: "feedback-loop-closer",
            label: "Feedback Loop Closer",
            blurb: "Reads guest complaints and groups them by theme to identify what operational changes would improve satisfaction.",
            starter: "A guest leaves a comment saying the burger was cold. We read it but don't know how many times this happens or what to fix. Daily, the tool reads our receipt comments, app reviews, and complaint cards and groups them by theme (cold food, long wait, order wrong), so we identify the top issues and can actually fix operations instead of just reading complaints.",
            components: ["Knowledge Assistant", "Genie", "Databricks Apps"],
            facets: {
              problem: "Read complaints but don't know how many times each happens or what to fix",
              how: "Groups complaints by theme to identify operational improvement areas",
              tool: "Knowledge Assistant to read complaints, Genie to ask the data, and a Databricks App as the interface",
              objective: "Identify top issues to actually fix operations",
            },
          },
          {
            id: "loyalty-points-suggestor",
            label: "Loyalty Points Suggestor",
            blurb: "Analyzes repeat-customer spending to recommend rewards and bonus-points offers that drive return visits.",
            starter: "We want to encourage loyalty but we're guessing at what rewards matter. Monthly, the tool reads our loyalty transaction data and identifies repeat customers, then suggests bonus-point offers or rewards (free burger after 5 visits, double points on Friday) tailored to each segment's spending pattern so we drive more repeat visits.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Guessing at what rewards matter to drive loyalty",
              how: "Analyzes repeat-customer spending to recommend tailored rewards",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Drive repeat visits with tailored rewards",
            },
          },
        ],
      },
      {
        outcome: "Reduce costs and waste",
        apps: [
          {
            id: "food-waste-tracker",
            label: "Food Waste Tracker",
            blurb: "Analyzes waste logs to spot which items are thrown away most and suggests prep or portion changes.",
            starter: "We throw away a lot of food but it's all tracked as a single waste number. Daily, the tool reads our waste logs and inventory data to identify which menu items are discarded most (oversized portions, expired prep, slow-selling items), and suggests portion or prep changes so we can reduce waste and food cost.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Throw away a lot of food tracked only as a single total waste number",
              how: "Analyzes waste logs to spot which items are thrown away most",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Reduce waste and food cost",
            },
          },
          {
            id: "labor-efficiency-analyzer",
            label: "Labor Efficiency Analyzer",
            blurb: "Compares labor hours against orders per shift to highlight periods where efficiency is low and costs are high.",
            starter: "Some shifts are packed but we're not tracking labor cost per order. Daily, the tool reads labor hours, order counts, and revenue per shift, and highlights shifts with low efficiency (high labor cost per order) so managers can see where to improve throughput or staffing without cutting service quality.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Not tracking labor cost per order, inefficient shifts go unnoticed",
              how: "Compares labor hours against orders per shift to highlight low efficiency",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Improve throughput without cutting service quality",
            },
          },
          {
            id: "menu-cost-profit-analyzer",
            label: "Menu Cost & Profit Analyzer",
            blurb: "Shows profit margin by menu item to identify which items to promote and which drain margins.",
            starter: "We know food cost for each item, but we're not sure which menu items we should push and which cost too much. Weekly, the tool reads our menu costs, sales volumes, and pricing and calculates profit margin by item, so we know which high-margin items to promote and which low-margin items to discontinue or reprice.",
            components: ["Genie", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Know food cost but unsure which items to promote and which drain margins",
              how: "Shows profit margin by menu item based on costs, volumes, and pricing",
              tool: "Genie to ask the data, Lakebase to save analyses, and a Databricks App as the interface",
              objective: "Know which items to promote and which to discontinue",
            },
          },
        ],
      },
    ],
  },
  {
    id: "beverage",
    label: "Beverage Distribution",
    industry: "beverage bottling and distribution (a bottler: retail outlets, coolers and vending machines, direct-store-delivery, and back-office finance)",
    columns: [
      {
        outcome: "Cut manual reporting and back-office load",
        apps: [
          {
            id: "ops-finance-report-autopilot",
            label: "Ops & Finance Report Autopilot",
            blurb: "Turns the recurring operations and finance reports analysts rebuild by hand into one accurate briefing they can trust.",
            starter: "Every week our operations and finance analysts rebuild the same reports by hand in spreadsheets, and small errors slip in that we only catch later. I want one place that reads our sales, delivery, and finance tables and produces the recurring operations and finance briefing automatically, with the key numbers reconciled so people stop second-guessing whether the figures are right. Each morning it should show the current numbers against last period and flag anything that looks off.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Analysts rebuild the same ops and finance reports by hand, and errors slip in",
              how: "Reads the source tables and produces the recurring briefing automatically, reconciled",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Cut manual reporting and stop people questioning the numbers",
            },
          },
          {
            id: "ap-invoice-copilot",
            label: "AP Invoice Copilot",
            blurb: "An agent that reads supplier invoices, matches them to purchase orders, and drafts the coding for accounts payable to approve.",
            starter: "Our accounts payable team keys in supplier invoices and manually matches them to purchase orders, which is slow and backs up at month end. I want an agent that reads each incoming invoice, matches it to the right PO and receipt, checks the amounts line up, and drafts the coding plus an approve-or-hold recommendation, so the AP clerk just reviews and approves instead of doing it all by hand. Every decision it makes should be recorded so we keep an audit trail.",
            components: ["Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "AP keys in invoices and matches POs by hand, backing up at month end",
              how: "Agent matches invoice to PO and receipt, checks amounts, drafts coding and an approve-or-hold call",
              tool: "An agent to do the work, Lakebase to record each decision, and a Databricks App as the interface",
              objective: "Clear the AP backlog with the clerk reviewing, not rekeying",
            },
          },
          {
            id: "po-self-help-agent",
            label: "Purchase Order Self-Help Agent",
            blurb: "Answers 'where does my purchase order stand' in plain English so buyers stop chasing status by email.",
            starter: "Buyers and requesters constantly ask our procurement team where a purchase order stands, and answering each one by email eats the day. I want a self-help agent people can ask in plain English about any PO, that reads our purchase order, receipt, and supplier tables and tells them the current status, what's outstanding, and expected delivery, and lets them flag one for follow-up. Routine status questions get answered instantly and the team only handles the real exceptions.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Procurement spends the day answering 'where is my PO' by email",
              how: "A self-help agent answers PO status questions and lets users flag one for follow-up",
              tool: "Genie to read the data, an agent to route, Lakebase to save follow-ups, and a Databricks App as the interface",
              objective: "Answer routine status instantly; handle only the real exceptions",
            },
          },
        ],
      },
      {
        outcome: "Grow revenue and commercial performance",
        apps: [
          {
            id: "store-tiering-engine",
            label: "Store Tiering Engine",
            blurb: "Groups outlets into performance tiers from sales, transactions, and local context so commercial teams focus where it pays.",
            starter: "We treat outlets too much the same when their commercial performance and potential are very different. I want to score and tier our outlets using their sales, transaction counts, product mix, and local context, so the commercial team can see which tier each outlet sits in and where there's room to grow. It should show each outlet's tier, why it landed there, and which under-performing outlets are the best opportunities to work on.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Outlets treated the same despite very different performance and potential",
              how: "Scores and tiers outlets from sales, transactions, mix, and local context",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Focus commercial effort where the upside is",
            },
          },
          {
            id: "product-elasticity-refresher",
            label: "Product Elasticity Refresher",
            blurb: "An autonomous agent that re-estimates price elasticity per product and proposes updated price points for review.",
            starter: "Our product price elasticities are stale because refreshing them is a manual analytics project nobody has time for. I want an autonomous agent that re-estimates elasticity for each product from our historical price and sales data, proposes an updated recommended price (or flags that the current price is off), and explains its reasoning, so a pricing analyst just reviews and approves the refreshed numbers. Every proposed change should be recorded so we can see what changed and why.",
            components: ["Supervisor agent", "Genie", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Price elasticities go stale because refreshing them is a manual project",
              how: "An agent re-estimates elasticity per product and proposes updated prices with reasoning",
              tool: "An agent to do the analysis, Genie for the data, Lakebase to record changes, and a Databricks App as the interface",
              objective: "Keep pricing current with an analyst approving, not rebuilding",
            },
          },
          {
            id: "machine-tier-optimizer",
            label: "Cooler & Machine Tier Optimizer",
            blurb: "Ranks coolers and vending machines by revenue per placement and flags which to move, upgrade, or re-stock.",
            starter: "We have coolers and vending machines placed across many locations but no clear read on which ones earn their spot. I want to rank each machine by revenue and throughput against comparable placements, and flag the under-performers that should be moved, upgraded, or re-stocked differently. Each morning the commercial team should see the machines most worth acting on and the recommended action for each.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "Coolers and machines placed widely with no clear read on which earn their spot",
              how: "Ranks each machine by revenue and throughput vs comparable placements and flags actions",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Move, upgrade, or re-stock the machines that aren't paying off",
            },
          },
        ],
      },
      {
        outcome: "People insight and AI value",
        apps: [
          {
            id: "headcount-turnover-explorer",
            label: "Headcount & Turnover Explorer",
            blurb: "Answers people-data questions about headcount trends and turnover by department in plain English.",
            starter: "Our leaders ask HR questions like how headcount has changed over the past year or which departments have the highest turnover, and answering each one is a manual pull. I want a place where they can ask people-data questions in plain English and get the answer back with a simple chart, reading our headcount and turnover tables. It should cover headcount trends over time and turnover by department without anyone building a one-off report.",
            components: ["Genie", "Databricks Apps"],
            facets: {
              problem: "People-data questions each need a manual HR pull",
              how: "Ask headcount and turnover questions in plain English, get an answer and a chart",
              tool: "Genie to ask the data and a Databricks App as the interface",
              objective: "Self-serve people insight without one-off reports",
            },
          },
          {
            id: "attrition-early-warning",
            label: "Attrition Early-Warning",
            blurb: "Flags departments and roles where turnover is trending up so HR can act before it worsens.",
            starter: "By the time we see a turnover spike in a department, we've already lost the people. I want something that reads our headcount and turnover history and flags where attrition is trending up by department and role, with the recent pattern behind each flag, so HR and managers can look into the causes early. It should open on the departments most at risk this period, not a big table.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
            facets: {
              problem: "Turnover spikes are seen only after the people are gone",
              how: "Flags departments and roles where attrition is trending up, with the pattern behind each",
              tool: "Genie to ask the data, an agent to tie the pieces together, and a Databricks App as the interface",
              objective: "Act on attrition risk early",
            },
          },
          {
            id: "ai-roi-tracker",
            label: "AI ROI Tracker",
            blurb: "Records the AI and automation solutions we ship and the productivity or cost benefit of each to show clear ROI.",
            starter: "We're delivering AI and automation solutions but can't point to the productivity benefit or ROI in a clear way, which makes the value hard to defend. I want a place to record each solution we ship, the hours or cost it saves, and who it helps, and to see the total benefit rolled up over time. It should let a delivery lead log a solution and its measured benefit, and show leadership the running evidence of value.",
            components: ["Genie", "Lakebase", "Databricks Apps"],
            facets: {
              problem: "Can't clearly point to the productivity benefit or ROI of the AI solutions we ship",
              how: "Records each solution and its measured benefit, rolled up over time",
              tool: "Genie to ask the data, Lakebase to save each logged solution, and a Databricks App as the interface",
              objective: "Show leadership running evidence of AI value",
            },
          },
        ],
      },
    ],
  },
];
