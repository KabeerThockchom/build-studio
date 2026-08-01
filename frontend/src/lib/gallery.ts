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
            starter: "Our store managers only find out a location is underperforming after the monthly report. I want something that watches daily sales and flags stores slipping early, and tells the manager what to look at.",
          },
          {
            id: "inventory-rebalancer",
            label: "Inventory Rebalancer",
            blurb: "Suggests which stores are overstocked and which need replenishment based on current stock levels.",
            starter: "We have the inventory counts, but rebalancing between stores is manual and slow. I want a tool that looks at what we have where and suggests which locations should send excess stock to stores that need it.",
          },
          {
            id: "auto-tag-products",
            label: "Auto-Tag New Products",
            blurb: "Reads product details and suggests category tags and metadata for merchandisers to approve.",
            starter: "When we add new products, our merchandisers manually tag and categorize them. I want something that reads the product details and suggests tags so they can just approve or edit.",
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
            starter: "We know which products sell together, but we're running the same bundle promotions everywhere. I want a tool that groups our products into relevant bundles based on actual purchase patterns.",
          },
          {
            id: "shopper-segment-finder",
            label: "Shopper Segment Finder",
            blurb: "Groups customers by behavior and purchase patterns to help marketing tailor campaigns to each segment.",
            starter: "Our marketing team manually segments our shopper base. I want something that looks at purchase history and flags natural customer groups so we can tailor messaging to each.",
          },
          {
            id: "price-optimization-spotter",
            label: "Price Optimization Spotter",
            blurb: "Identifies products that are priced too low or too high relative to demand and historical patterns.",
            starter: "We have historical price and sales data. I want to see which of our items are underpriced relative to their demand, so we know where we have room to adjust.",
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
            starter: "We get shipments from many suppliers but I'm only looking at invoices to know how they're doing. I want a dashboard that tracks which suppliers are reliable vs late.",
          },
          {
            id: "demand-forecast-helper",
            label: "Demand Forecast Helper",
            blurb: "Analyzes historical sales to spot seasonal patterns and predict future demand for better inventory planning.",
            starter: "Every quarter we manually guess how much inventory to order. I want a tool that looks at our sales history and highlights patterns so I can make a smarter forecast.",
          },
          {
            id: "return-reason-analyzer",
            label: "Return Reason Analyzer",
            blurb: "Groups returned items by reason to surface product or process issues affecting customer satisfaction.",
            starter: "We track returns but nobody connects them to root causes. I want something that reads return notes and groups them by why customers are sending things back.",
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
        outcome: "Agentic AI Operations",
        apps: [
          {
            id: "reservation-issue-responder",
            label: "Reservation Issue Responder",
            blurb: "Reads booking issues in guest emails and routes them to the right team or auto-resolves common problems.",
            starter: "Our reservation team gets flooded with guest emails about booking problems. I want something that reads each one and either answers the common ones or routes the tricky ones to the right person.",
          },
          {
            id: "revenue-manager-assistant",
            label: "Revenue Manager's Assistant",
            blurb: "Suggests rate adjustments based on occupancy, demand signals, and historical trends to optimize nightly revenue.",
            starter: "Our revenue manager adjusts room rates manually each day based on occupancy and feeling. I want a tool that looks at our data and shows her what rates to set to optimize revenue.",
          },
          {
            id: "housekeeping-prioritizer",
            label: "Housekeeping Prioritizer",
            blurb: "Ranks rooms by priority based on checkout status, VIP guests, and recent complaints to guide daily cleaning order.",
            starter: "Housekeeping gets a list of rooms to clean but no priority. I want a tool that reads check-in notes and complaint history to tell housekeeping which rooms to prioritize today.",
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
            starter: "We're leaving money on the table. When a guest books a room, we don't suggest relevant extras like spa, dining packages, or activities. I want a tool that recommends the right add-ons per guest.",
          },
          {
            id: "event-space-optimizer",
            label: "Event Space Optimizer",
            blurb: "Identifies underutilized event spaces and time slots to suggest targeted promotions and fill gaps.",
            starter: "Our event planner knows which spaces are booked when, but doesn't see the gaps. I want a dashboard that shows which event spaces are empty when and suggests where to run promotions.",
          },
          {
            id: "loyalty-tier-analyzer",
            label: "Loyalty Tier Analyzer",
            blurb: "Flags guests close to their next loyalty tier and suggests targeted incentive offers to drive upgrades.",
            starter: "We know which guests are close to upgrading their loyalty tier, but we're not reaching out with targeted offers. I want a tool that flags those guests and suggests the best incentive offer.",
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
            starter: "We get hundreds of guest reviews but they're all in a pile. I want something that reads them and groups feedback by topic (room quality, staff, food, etc.) so we can see what matters most.",
          },
          {
            id: "personalized-experience-generator",
            label: "Personalized Experience Generator",
            blurb: "Reads past stays and guest history to flag preferences and anticipate needs for a personalized stay.",
            starter: "Our staff doesn't know that Mr. Johnson always orders coffee black at 7am or that the Rodriguez family has kids. I want a tool that reads past stays and flags key preferences so staff can anticipate needs.",
          },
          {
            id: "complaint-early-responder",
            label: "Complaint Early Responder",
            blurb: "Monitors real-time guest feedback during their stay to flag issues early before they become negative reviews.",
            starter: "By the time we see a negative review, it's too late. I want something that reads guest comments during their stay and flags problems early so we can fix them before checkout.",
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
            starter: "We manually schedule crew based on guesses about how busy we'll be. I want a tool that looks at historical traffic patterns and suggests how many crew we need each shift.",
          },
          {
            id: "inventory-depletion-alerter",
            label: "Inventory Depletion Alerter",
            blurb: "Flags items running low in real-time so managers can reorder before stockouts disrupt service.",
            starter: "We run out of popular items because we don't notice until too late. I want something that tracks our inventory counts and alerts the manager when something is getting low.",
          },
          {
            id: "equipment-maintenance-scheduler",
            label: "Equipment Maintenance Scheduler",
            blurb: "Predicts when equipment needs service based on usage patterns to prevent unexpected breakdowns.",
            starter: "Our fryer or ice cream machine breaks unexpectedly and loses us time. I want a tool that looks at how much we use each piece of equipment and predicts when it needs maintenance.",
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
            starter: "We send the same promotions to everyone. I want something that looks at our customer data and suggests what offers or menu items each person would be interested in.",
          },
          {
            id: "feedback-loop-closer",
            label: "Feedback Loop Closer",
            blurb: "Reads guest complaints and groups them by theme to identify what operational changes would improve satisfaction.",
            starter: "A guest leaves a comment saying the burger was cold. We read it but don't know how many times this happens or what to fix. I want something that groups feedback and tells us what to address.",
          },
          {
            id: "loyalty-points-suggestor",
            label: "Loyalty Points Suggestor",
            blurb: "Analyzes repeat-customer spending to recommend rewards and bonus-points offers that drive return visits.",
            starter: "We want to encourage loyalty but we're guessing at what rewards matter. I want a tool that analyzes repeat customer spending and suggests what rewards would make them come back more.",
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
            starter: "We throw away a lot of food but it's all tracked as a single waste number. I want something that reads what we're throwing away most and suggests how to prep or portion differently.",
          },
          {
            id: "labor-efficiency-analyzer",
            label: "Labor Efficiency Analyzer",
            blurb: "Compares labor hours against orders per shift to highlight periods where efficiency is low and costs are high.",
            starter: "Some shifts are packed but we're not tracking labor cost per order. I want a tool that looks at orders vs crew hours and shows me which shifts have low efficiency.",
          },
          {
            id: "menu-cost-profit-analyzer",
            label: "Menu Cost & Profit Analyzer",
            blurb: "Shows profit margin by menu item to identify which items to promote and which drain margins.",
            starter: "We know food cost for each item, but we're not sure which menu items we should push and which cost too much. I want a dashboard showing profit margin by item.",
          },
        ],
      },
    ],
  },
];
