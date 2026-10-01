/**
 * The idea gallery: example ideas to spark a Sit-Down. Picking one fills the idea box with an editable
 * starter sentence; the Sit-Down takes it from there (the SA works out the industry, the colleagues and
 * the pieces from the idea itself, so nothing else is carried).
 *
 * Facilitators: before a workshop, add a vertical (or a company-specific set) as one more entry in
 * GALLERY, with 3 outcome columns of up to 3 ideas each. Write starters the way a participant would say
 * them: who has the problem, when it happens, what they'd do with the answer.
 */

export interface SampleApp {
  id: string;        // kebab-case slug, unique across the whole file
  label: string;     // the idea's name, 2-4 words
  blurb: string;     // one plain sentence: what it does and who it helps
  starter: string;   // the editable first-person idea it fills in
  facets?: { problem: string; how: string; objective: string };
}

export interface OutcomeColumn { outcome: string; apps: SampleApp[]; }

export interface GalleryVertical {
  id: string;
  label: string;
  industry: string;
  columns: OutcomeColumn[];
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
            facets: {
              problem: "Managers find out about underperformance too late, after the monthly report",
              how: "Daily check of sales against targets, highlights which stores are trending down",
              objective: "Catch problems early before they compound",
            },
          },
          {
            id: "inventory-rebalancer",
            label: "Inventory Rebalancer",
            blurb: "Suggests which stores are overstocked and which need replenishment based on current stock levels.",
            starter: "We have the inventory counts, but rebalancing between stores is manual and slow. Once a week, our supply chain team needs to redistribute stock across locations to avoid markdowns and stockouts. The tool reads current inventory counts by store and SKU, and suggests which locations have excess and which need replenishment, so the team can make faster transfer decisions.",
            facets: {
              problem: "Rebalancing stock between stores is manual and slow, causing markdowns or stockouts",
              how: "Suggests which stores are overstocked and which need replenishment based on current counts",
              objective: "Speed up transfers and avoid markdowns or stockouts",
            },
          },
          {
            id: "auto-tag-products",
            label: "Auto-Tag New Products",
            blurb: "Reads product details and suggests category tags and metadata for merchandisers to approve.",
            starter: "When we add new products, our merchandisers manually tag and categorize them, which slows down time-to-shelf. Each day when new SKUs arrive, the tool reads the product description, supplier category, and attributes, and suggests tags and metadata so the merchandisers can approve or edit in minutes instead of manually building them from scratch.",
            facets: {
              problem: "Merchandisers manually tag new products, slowing time-to-shelf",
              how: "Reads product details and suggests category tags and metadata for approval",
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
            facets: {
              problem: "Running same bundle promotions everywhere instead of tailored to actual customer behavior",
              how: "Analyzes purchase history to identify which products sell together",
              objective: "Create bundles based on actual customer behavior",
            },
          },
          {
            id: "shopper-segment-finder",
            label: "Shopper Segment Finder",
            blurb: "Groups customers by behavior and purchase patterns to help marketing tailor campaigns to each segment.",
            starter: "Our marketing team manually segments our shopper base before each campaign, which delays launches and feels outdated fast. The tool reads our transaction history and loyalty account data, identifies natural customer clusters by purchase frequency, spend, and category preferences, so marketing can send targeted campaigns to each group instead of one-size-fits-all blasts.",
            facets: {
              problem: "Marketing team manually segments shoppers before each campaign, delays launches",
              how: "Groups customers by behavior and purchase patterns into natural clusters",
              objective: "Enable targeted campaigns instead of one-size-fits-all",
            },
          },
          {
            id: "price-optimization-spotter",
            label: "Price Optimization Spotter",
            blurb: "Identifies products that are priced too low or too high relative to demand and historical patterns.",
            starter: "We have historical price and sales data, but our pricing stays static even when demand shifts. Monthly, the tool reads our price history, sales volume, and competitor pricing, and flags items that are underpriced relative to demand or overpriced relative to sales, so we know where pricing room exists to improve margin.",
            facets: {
              problem: "Pricing stays static even when demand shifts",
              how: "Identifies products priced too low or too high relative to demand",
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
            facets: {
              problem: "Only looking at invoices to assess supplier performance",
              how: "Tracks on-time delivery, quality, and lead times for each supplier",
              objective: "Identify reliable vs problematic partners",
            },
          },
          {
            id: "demand-forecast-helper",
            label: "Demand Forecast Helper",
            blurb: "Analyzes historical sales to spot seasonal patterns and predict future demand for better inventory planning.",
            starter: "Every quarter we manually guess how much inventory to order, often ending up with too much or too little. The tool reads our historical sales data by product and season, identifies patterns and trends, and predicts demand for the next quarter so we can order the right quantities and reduce carrying costs and stockouts.",
            facets: {
              problem: "Manually guessing inventory orders each quarter, often ordering too much or too little",
              how: "Analyzes historical sales to spot seasonal patterns and predict future demand",
              objective: "Order right quantities to reduce carrying costs and stockouts",
            },
          },
          {
            id: "return-reason-analyzer",
            label: "Return Reason Analyzer",
            blurb: "Groups returned items by reason to surface product or process issues affecting customer satisfaction.",
            starter: "We track returns but nobody connects them to root causes. Daily, the tool reads our return notes and invoice data, groups returns by reason (size, quality, color mismatch, etc.), and surfaces the top problems so we can prioritize what to fix to reduce returns and improve customer satisfaction.",
            facets: {
              problem: "Track returns but don't connect them to root causes",
              how: "Groups returned items by reason to surface product or process issues",
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
            facets: {
              problem: "Reservation team flooded with guest emails about booking problems",
              how: "Reads booking issues and auto-resolves common problems or routes to the right person",
              objective: "Spend time on real issues instead of repetitive triage",
            },
          },
          {
            id: "revenue-manager-assistant",
            label: "Revenue Manager's Assistant",
            blurb: "Suggests rate adjustments based on occupancy, demand signals, and historical trends to optimize nightly revenue.",
            starter: "Our revenue manager adjusts room rates manually each day based on occupancy and intuition. Each morning, the tool reads current occupancy, historical rates, forward bookings, and competitor pricing, and shows rate recommendations for each room type so the manager can maximize nightly revenue with data-driven adjustments.",
            facets: {
              problem: "Revenue manager adjusts rates manually each day based on intuition",
              how: "Suggests rate adjustments based on occupancy, demand signals, and historical trends",
              objective: "Maximize nightly revenue with data-driven adjustments",
            },
          },
          {
            id: "housekeeping-prioritizer",
            label: "Housekeeping Prioritizer",
            blurb: "Ranks rooms by priority based on checkout status, VIP guests, and recent complaints to guide daily cleaning order.",
            starter: "Housekeeping gets a list of rooms to clean but no priority, so they guess which to tackle first. Each morning, the tool reads checkout times, guest history, room type, complaints and special requests, and ranks rooms so VIP guests and high-complaint rooms get attention first, and rooms checking in soon are ready on time.",
            facets: {
              problem: "Housekeeping gets a list of rooms with no priority guidance",
              how: "Ranks rooms by priority based on checkout status, VIP guests, and complaints",
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
            facets: {
              problem: "Not suggesting relevant extras at booking or check-in",
              how: "Suggests add-on services based on each guest's profile and history",
              objective: "Increase ancillary revenue per guest",
            },
          },
          {
            id: "event-space-optimizer",
            label: "Event Space Optimizer",
            blurb: "Identifies underutilized event spaces and time slots to suggest targeted promotions and fill gaps.",
            starter: "Our event planner knows which spaces are booked, but doesn't see the gaps. Weekly, the tool reads our event bookings and availability calendar and identifies low-booked time slots and spaces, so the planner can run targeted promotions to fill ballrooms on slow weekends or meeting spaces mid-week.",
            facets: {
              problem: "Event planner knows which spaces are booked but doesn't see gaps",
              how: "Identifies underutilized spaces and time slots",
              objective: "Fill gaps with targeted promotions",
            },
          },
          {
            id: "loyalty-tier-analyzer",
            label: "Loyalty Tier Analyzer",
            blurb: "Flags guests close to their next loyalty tier and suggests targeted incentive offers to drive upgrades.",
            starter: "We know which guests are close to upgrading their loyalty tier, but we're not reaching out proactively. Monthly, the tool reads our loyalty database and guest history, flags members within a few stays of the next tier, and suggests the best incentive (free night, room upgrade, dining credit) to nudge them to book again and qualify.",
            facets: {
              problem: "Guests close to next loyalty tier but not reaching out proactively",
              how: "Flags guests close to upgrading and suggests targeted incentive offers",
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
            facets: {
              problem: "Hundreds of guest reviews in a pile, no theme organization",
              how: "Reads reviews and groups them by theme to surface improvement areas",
              objective: "Know exactly what to prioritize fixing",
            },
          },
          {
            id: "personalized-experience-generator",
            label: "Personalized Experience Generator",
            blurb: "Reads past stays and guest history to flag preferences and anticipate needs for a personalized stay.",
            starter: "Our staff doesn't know that Mr. Johnson always orders coffee black at 7am or that the Rodriguez family has kids. At check-in, the tool reads the guest's stay history, preferences, dietary notes, and past room choices, and flags key details so staff can greet them warmly and anticipate needs without being asked.",
            facets: {
              problem: "Staff doesn't know guest preferences and past requests",
              how: "Reads past stays and guest history to flag preferences",
              objective: "Anticipate needs and personalize check-in",
            },
          },
          {
            id: "complaint-early-responder",
            label: "Complaint Early Responder",
            blurb: "Monitors real-time guest feedback during their stay to flag issues early before they become negative reviews.",
            starter: "By the time we see a negative review, it's too late. During each guest's stay, the tool checks maintenance requests, service calls, and in-app comments and surfaces problems (broken AC, late checkout denied, rude staff comment) so a manager can reach out and fix it before checkout, turning a bad stay into a recovery win.",
            facets: {
              problem: "Only see negative reviews after checkout, too late to fix",
              how: "Monitors real-time guest feedback during stay to flag issues early",
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
            facets: {
              problem: "Manually scheduling crew based on guesses, often over/under-staffing",
              how: "Suggests staffing levels based on predicted traffic and historical patterns",
              objective: "Balance coverage and labor costs",
            },
          },
          {
            id: "inventory-depletion-alerter",
            label: "Inventory Depletion Alerter",
            blurb: "Flags items running low in real-time so managers can reorder before stockouts disrupt service.",
            starter: "We run out of popular items because we don't notice until too late. Each shift, the tool reads our point-of-sale data and inventory counts, predicts which items will run out based on usage, and alerts the manager so they can reorder before stockouts hurt sales and customer satisfaction.",
            facets: {
              problem: "Run out of popular items because we don't notice until too late",
              how: "Flags items running low in real-time based on predicted usage",
              objective: "Prevent stockouts that hurt sales",
            },
          },
          {
            id: "equipment-maintenance-scheduler",
            label: "Equipment Maintenance Scheduler",
            blurb: "Predicts when equipment needs service based on usage patterns to prevent unexpected breakdowns.",
            starter: "Our fryer or ice cream machine breaks unexpectedly during peak hours and loses us time and sales. Daily, the tool reads our equipment usage logs and maintenance history to predict when each piece needs service, so we can schedule maintenance during downtime and avoid breakdowns that kill revenue.",
            facets: {
              problem: "Equipment breaks unexpectedly during peak hours, loses time and sales",
              how: "Predicts when equipment needs service based on usage patterns",
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
            facets: {
              problem: "Sending same promotions to everyone",
              how: "Suggests relevant menu items or promotions for each customer segment",
              objective: "Increase order values and repeat visits",
            },
          },
          {
            id: "feedback-loop-closer",
            label: "Feedback Loop Closer",
            blurb: "Reads guest complaints and groups them by theme to identify what operational changes would improve satisfaction.",
            starter: "A guest leaves a comment saying the burger was cold. We read it but don't know how many times this happens or what to fix. Daily, the tool reads our receipt comments, app reviews, and complaint cards and groups them by theme (cold food, long wait, order wrong), so we identify the top issues and can actually fix operations instead of just reading complaints.",
            facets: {
              problem: "Read complaints but don't know how many times each happens or what to fix",
              how: "Groups complaints by theme to identify operational improvement areas",
              objective: "Identify top issues to actually fix operations",
            },
          },
          {
            id: "loyalty-points-suggestor",
            label: "Loyalty Points Suggestor",
            blurb: "Analyzes repeat-customer spending to recommend rewards and bonus-points offers that drive return visits.",
            starter: "We want to encourage loyalty but we're guessing at what rewards matter. Monthly, the tool reads our loyalty transaction data and identifies repeat customers, then suggests bonus-point offers or rewards (free burger after 5 visits, double points on Friday) tailored to each segment's spending pattern so we drive more repeat visits.",
            facets: {
              problem: "Guessing at what rewards matter to drive loyalty",
              how: "Analyzes repeat-customer spending to recommend tailored rewards",
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
            facets: {
              problem: "Throw away a lot of food tracked only as a single total waste number",
              how: "Analyzes waste logs to spot which items are thrown away most",
              objective: "Reduce waste and food cost",
            },
          },
          {
            id: "labor-efficiency-analyzer",
            label: "Labor Efficiency Analyzer",
            blurb: "Compares labor hours against orders per shift to highlight periods where efficiency is low and costs are high.",
            starter: "Some shifts are packed but we're not tracking labor cost per order. Daily, the tool reads labor hours, order counts, and revenue per shift, and highlights shifts with low efficiency (high labor cost per order) so managers can see where to improve throughput or staffing without cutting service quality.",
            facets: {
              problem: "Not tracking labor cost per order, inefficient shifts go unnoticed",
              how: "Compares labor hours against orders per shift to highlight low efficiency",
              objective: "Improve throughput without cutting service quality",
            },
          },
          {
            id: "menu-cost-profit-analyzer",
            label: "Menu Cost & Profit Analyzer",
            blurb: "Shows profit margin by menu item to identify which items to promote and which drain margins.",
            starter: "We know food cost for each item, but we're not sure which menu items we should push and which cost too much. Weekly, the tool reads our menu costs, sales volumes, and pricing and calculates profit margin by item, so we know which high-margin items to promote and which low-margin items to discontinue or reprice.",
            facets: {
              problem: "Know food cost but unsure which items to promote and which drain margins",
              how: "Shows profit margin by menu item based on costs, volumes, and pricing",
              objective: "Know which items to promote and which to discontinue",
            },
          },
        ],
      },
    ],
  },
];
