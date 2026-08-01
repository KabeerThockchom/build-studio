/**
 * Gallery of sample apps for the Build Studio workshop.
 *
 * Each card in the gallery represents a concrete one-day-buildable app idea.
 * Picking a card prefills the idea box with a realistic starter sentence
 * and carries the vertical's `industry` field silently into the SA prompt
 * to ground the generated code in real vertical-specific context.
 *
 * Structure: 3 verticals × 3 outcome columns × 3 sample apps = 27 total apps.
 * All `id` values are unique kebab-case slugs.
 */

export interface SampleApp {
  id: string;        // kebab-case slug, unique across the whole file
  label: string;     // the app name, e.g. "Store Slip Detector" — short, punchy, 2-4 words
  blurb: string;     // ONE plain sentence: what it does + who it helps. No hype, no adjectives like "powerful"/"seamless".
  starter: string;   // an editable first-person idea sentence the user could have typed themselves
  components: string[]; // default app pieces this sample pre-selects in Assemble; user can still tweak
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
          },
          {
            id: "inventory-rebalancer",
            label: "Inventory Rebalancer",
            blurb: "Suggests which stores are overstocked and which need replenishment based on current stock levels.",
            starter: "We have the inventory counts, but rebalancing between stores is manual and slow. Once a week, our supply chain team needs to redistribute stock across locations to avoid markdowns and stockouts. The tool reads current inventory counts by store and SKU, and suggests which locations have excess and which need replenishment, so the team can make faster transfer decisions.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
          },
          {
            id: "auto-tag-products",
            label: "Auto-Tag New Products",
            blurb: "Reads product details and suggests category tags and metadata for merchandisers to approve.",
            starter: "When we add new products, our merchandisers manually tag and categorize them, which slows down time-to-shelf. Each day when new SKUs arrive, the tool reads the product description, supplier category, and attributes, and suggests tags and metadata so the merchandisers can approve or edit in minutes instead of manually building them from scratch.",
            components: ["Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
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
          },
          {
            id: "shopper-segment-finder",
            label: "Shopper Segment Finder",
            blurb: "Groups customers by behavior and purchase patterns to help marketing tailor campaigns to each segment.",
            starter: "Our marketing team manually segments our shopper base before each campaign, which delays launches and feels outdated fast. The tool reads our transaction history and loyalty account data, identifies natural customer clusters by purchase frequency, spend, and category preferences, so marketing can send targeted campaigns to each group instead of one-size-fits-all blasts.",
            components: ["Genie", "Databricks Apps"],
          },
          {
            id: "price-optimization-spotter",
            label: "Price Optimization Spotter",
            blurb: "Identifies products that are priced too low or too high relative to demand and historical patterns.",
            starter: "We have historical price and sales data, but our pricing stays static even when demand shifts. Monthly, the tool reads our price history, sales volume, and competitor pricing, and flags items that are underpriced relative to demand or overpriced relative to sales, so we know where pricing room exists to improve margin.",
            components: ["Genie", "Databricks Apps"],
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
          },
          {
            id: "demand-forecast-helper",
            label: "Demand Forecast Helper",
            blurb: "Analyzes historical sales to spot seasonal patterns and predict future demand for better inventory planning.",
            starter: "Every quarter we manually guess how much inventory to order, often ending up with too much or too little. The tool reads our historical sales data by product and season, identifies patterns and trends, and predicts demand for the next quarter so we can order the right quantities and reduce carrying costs and stockouts.",
            components: ["Genie", "Databricks Apps"],
          },
          {
            id: "return-reason-analyzer",
            label: "Return Reason Analyzer",
            blurb: "Groups returned items by reason to surface product or process issues affecting customer satisfaction.",
            starter: "We track returns but nobody connects them to root causes. Daily, the tool reads our return notes and invoice data, groups returns by reason (size, quality, color mismatch, etc.), and surfaces the top problems so we can prioritize what to fix to reduce returns and improve customer satisfaction.",
            components: ["Knowledge Assistant", "Genie", "Databricks Apps"],
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
          },
          {
            id: "revenue-manager-assistant",
            label: "Revenue Manager's Assistant",
            blurb: "Suggests rate adjustments based on occupancy, demand signals, and historical trends to optimize nightly revenue.",
            starter: "Our revenue manager adjusts room rates manually each day based on occupancy and intuition. Each morning, the tool reads current occupancy, historical rates, forward bookings, and competitor pricing, and shows rate recommendations for each room type so the manager can maximize nightly revenue with data-driven adjustments.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
          },
          {
            id: "housekeeping-prioritizer",
            label: "Housekeeping Prioritizer",
            blurb: "Ranks rooms by priority based on checkout status, VIP guests, and recent complaints to guide daily cleaning order.",
            starter: "Housekeeping gets a list of rooms to clean but no priority, so they guess which to tackle first. Each morning, the tool reads checkout times, guest history, room type, complaints and special requests, and ranks rooms so VIP guests and high-complaint rooms get attention first, and rooms checking in soon are ready on time.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
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
          },
          {
            id: "event-space-optimizer",
            label: "Event Space Optimizer",
            blurb: "Identifies underutilized event spaces and time slots to suggest targeted promotions and fill gaps.",
            starter: "Our event planner knows which spaces are booked, but doesn't see the gaps. Weekly, the tool reads our event bookings and availability calendar and identifies low-booked time slots and spaces, so the planner can run targeted promotions to fill ballrooms on slow weekends or meeting spaces mid-week.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
          },
          {
            id: "loyalty-tier-analyzer",
            label: "Loyalty Tier Analyzer",
            blurb: "Flags guests close to their next loyalty tier and suggests targeted incentive offers to drive upgrades.",
            starter: "We know which guests are close to upgrading their loyalty tier, but we're not reaching out proactively. Monthly, the tool reads our loyalty database and guest history, flags members within a few stays of the next tier, and suggests the best incentive (free night, room upgrade, dining credit) to nudge them to book again and qualify.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
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
          },
          {
            id: "personalized-experience-generator",
            label: "Personalized Experience Generator",
            blurb: "Reads past stays and guest history to flag preferences and anticipate needs for a personalized stay.",
            starter: "Our staff doesn't know that Mr. Johnson always orders coffee black at 7am or that the Rodriguez family has kids. At check-in, the tool reads the guest's stay history, preferences, dietary notes, and past room choices, and flags key details so staff can greet them warmly and anticipate needs without being asked.",
            components: ["Knowledge Assistant", "Supervisor agent", "Databricks Apps"],
          },
          {
            id: "complaint-early-responder",
            label: "Complaint Early Responder",
            blurb: "Monitors real-time guest feedback during their stay to flag issues early before they become negative reviews.",
            starter: "By the time we see a negative review, it's too late. During each guest's stay, the tool checks maintenance requests, service calls, and in-app comments and surfaces problems (broken AC, late checkout denied, rude staff comment) so a manager can reach out and fix it before checkout, turning a bad stay into a recovery win.",
            components: ["Knowledge Assistant", "Supervisor agent", "Lakebase", "Databricks Apps"],
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
          },
          {
            id: "inventory-depletion-alerter",
            label: "Inventory Depletion Alerter",
            blurb: "Flags items running low in real-time so managers can reorder before stockouts disrupt service.",
            starter: "We run out of popular items because we don't notice until too late. Each shift, the tool reads our point-of-sale data and inventory counts, predicts which items will run out based on usage, and alerts the manager so they can reorder before stockouts hurt sales and customer satisfaction.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
          },
          {
            id: "equipment-maintenance-scheduler",
            label: "Equipment Maintenance Scheduler",
            blurb: "Predicts when equipment needs service based on usage patterns to prevent unexpected breakdowns.",
            starter: "Our fryer or ice cream machine breaks unexpectedly during peak hours and loses us time and sales. Daily, the tool reads our equipment usage logs and maintenance history to predict when each piece needs service, so we can schedule maintenance during downtime and avoid breakdowns that kill revenue.",
            components: ["Genie", "Supervisor agent", "Lakebase", "Databricks Apps"],
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
          },
          {
            id: "feedback-loop-closer",
            label: "Feedback Loop Closer",
            blurb: "Reads guest complaints and groups them by theme to identify what operational changes would improve satisfaction.",
            starter: "A guest leaves a comment saying the burger was cold. We read it but don't know how many times this happens or what to fix. Daily, the tool reads our receipt comments, app reviews, and complaint cards and groups them by theme (cold food, long wait, order wrong), so we identify the top issues and can actually fix operations instead of just reading complaints.",
            components: ["Knowledge Assistant", "Genie", "Databricks Apps"],
          },
          {
            id: "loyalty-points-suggestor",
            label: "Loyalty Points Suggestor",
            blurb: "Analyzes repeat-customer spending to recommend rewards and bonus-points offers that drive return visits.",
            starter: "We want to encourage loyalty but we're guessing at what rewards matter. Monthly, the tool reads our loyalty transaction data and identifies repeat customers, then suggests bonus-point offers or rewards (free burger after 5 visits, double points on Friday) tailored to each segment's spending pattern so we drive more repeat visits.",
            components: ["Genie", "Supervisor agent", "Databricks Apps"],
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
          },
          {
            id: "labor-efficiency-analyzer",
            label: "Labor Efficiency Analyzer",
            blurb: "Compares labor hours against orders per shift to highlight periods where efficiency is low and costs are high.",
            starter: "Some shifts are packed but we're not tracking labor cost per order. Daily, the tool reads labor hours, order counts, and revenue per shift, and highlights shifts with low efficiency (high labor cost per order) so managers can see where to improve throughput or staffing without cutting service quality.",
            components: ["Genie", "Databricks Apps"],
          },
          {
            id: "menu-cost-profit-analyzer",
            label: "Menu Cost & Profit Analyzer",
            blurb: "Shows profit margin by menu item to identify which items to promote and which drain margins.",
            starter: "We know food cost for each item, but we're not sure which menu items we should push and which cost too much. Weekly, the tool reads our menu costs, sales volumes, and pricing and calculates profit margin by item, so we know which high-margin items to promote and which low-margin items to discontinue or reprice.",
            components: ["Genie", "Lakebase", "Databricks Apps"],
          },
        ],
      },
    ],
  },
];
