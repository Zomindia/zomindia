export interface DurationPhase {
  name: string;
  duration: string;
  description: string;
}

export interface EstimatedDurationResult {
  totalMinutes: number;
  displayText: string;
  setupMinutes: number;
  activeMinutes: number;
  cleanupMinutes: number;
  expectationNote: string;
  phases: DurationPhase[];
  affectingFactors: string[];
}

/**
 * Parses the base duration string (e.g., "120 mins", "2 Hours", "45 mins") into minutes
 */
export function parseDurationToMinutes(durationStr?: string): number {
  if (!durationStr) return 60;
  const clean = durationStr.toLowerCase().replace(/[^0-9.]/g, "");
  const num = parseFloat(clean);
  if (isNaN(num)) return 60;

  if (durationStr.toLowerCase().includes("hour") || durationStr.toLowerCase().includes("hr")) {
    return Math.round(num * 60);
  }
  return Math.round(num);
}

/**
 * Gets a comprehensive duration estimation and breakdown based on service name and category
 */
export function getEstimatedDurationDetails(
  serviceName: string,
  categoryName: string,
  baseDurationStr?: string,
  sizeMultiplier: 'small' | 'medium' | 'large' = 'medium'
): EstimatedDurationResult {
  const normCategory = categoryName.toLowerCase();
  const normService = serviceName.toLowerCase();

  // 1. Determine base minutes
  let baseMinutes = parseDurationToMinutes(baseDurationStr);

  // Fallbacks if parsed base minutes is very low or generic
  if (baseMinutes <= 15) {
    if (normCategory.includes("cleaning")) baseMinutes = 120;
    else if (normCategory.includes("painting")) baseMinutes = 240;
    else if (normCategory.includes("beauty")) baseMinutes = 60;
    else if (normCategory.includes("appliance") || normCategory.includes("repair")) baseMinutes = 90;
    else baseMinutes = 60;
  }

  // 2. Apply interactive size/scale modifier
  // 'small' -> e.g. 1 BHK / Single item / Quick check (0.7x duration)
  // 'medium' -> e.g. 2 BHK / Standard service / Standard diagnosis (1.0x duration)
  // 'large' -> e.g. 3+ BHK / Multi-appliance / Complex issue (1.5x duration)
  let scaleFactor = 1.0;
  if (sizeMultiplier === 'small') scaleFactor = 0.75;
  if (sizeMultiplier === 'large') scaleFactor = 1.4;

  const totalMinutes = Math.round(baseMinutes * scaleFactor);

  // 3. Subdivide into Setup, Active work, and Post-cleanup
  // Setup: typically 15-25% of total, capped at 45 mins
  const setupMinutes = Math.min(Math.round(totalMinutes * 0.20), 45);
  // Cleanup: typically 10-15% of total, capped at 30 mins
  const cleanupMinutes = Math.min(Math.round(totalMinutes * 0.15), 30);
  // Active work is the remainder
  const activeMinutes = Math.max(totalMinutes - setupMinutes - cleanupMinutes, 15);

  // 4. Generate metadata & phases based on category
  let expectationNote = "Our professionals adhere to standard efficiency norms. Times may vary slightly based on actual site conditions.";
  let affectingFactors: string[] = [];
  let phases: DurationPhase[] = [];

  if (normCategory.includes("cleaning")) {
    expectationNote = "Heavy stains, high ceiling fans, or extensive balcony cleanings may take extra time.";
    affectingFactors = [
      "Total area (BHK count & square footage)",
      "Level of dirt or construction residue",
      "Presence of heavy furniture or occupancy status"
    ];
    phases = [
      {
        name: "Setup & Equipment Prep",
        duration: `${setupMinutes} mins`,
        description: "Unpacking eco-chemicals, vacuum check, and room-by-room staging."
      },
      {
        name: "Deep Cleaning & Scrubbing",
        duration: `${activeMinutes} mins`,
        description: "Scrubbing floors, sanitizing bathrooms, and vacuuming upholstery."
      },
      {
        name: "Final Check & Sanitization",
        duration: `${cleanupMinutes} mins`,
        description: "Applying fragrant protective shield, final dust inspection, and tool packing."
      }
    ];
  } else if (normCategory.includes("painting")) {
    expectationNote = "Adequate drying time between coats is essential for a premium look & durability.";
    affectingFactors = [
      "Wall dampness and putty repairing requirements",
      "Humidity levels (affects drying rate)",
      "Furniture masking and paint shades selection"
    ];
    phases = [
      {
        name: "Furniture Masking & Scaffolding",
        duration: `${setupMinutes} mins`,
        description: "Covering your floors and valuables with heavy protective sheets and taping edges."
      },
      {
        name: "Sanding & Painting",
        duration: `${activeMinutes} mins`,
        description: "Applying professional leveling coat followed by two paint coats for maximum shine."
      },
      {
        name: "Touchups & Tape Removal",
        duration: `${cleanupMinutes} mins`,
        description: "Masking tape peel off, cleaning floor splatter, and checking under expert lights."
      }
    ];
  } else if (normCategory.includes("beauty") || normCategory.includes("salon")) {
    expectationNote = "Skin analysis and custom product mixture are prepared in front of the customer.";
    affectingFactors = [
      "Custom skin/hair sensitivity checks",
      "Complexity of chosen styles or treatments",
      "Sequencing for multi-service bundles"
    ];
    phases = [
      {
        name: "Sterilization & Bed Prep",
        duration: `${setupMinutes} mins`,
        description: "Sterilizing tools, setting up premium single-use disposable towels & creams."
      },
      {
        name: "Active Treatment Session",
        duration: `${activeMinutes} mins`,
        description: "Careful application of massage, facials, waxing, or styling therapies."
      },
      {
        name: "Post-care Skin Assessment",
        duration: `${cleanupMinutes} mins`,
        description: "Applying calming serums, cleaning workspace, and explaining glow maintenance tips."
      }
    ];
  } else if (normCategory.includes("appliance") || normCategory.includes("repair") || normCategory.includes("phone")) {
    expectationNote = "Diagnostic check is completed first to give a final repair quote. Parts sourcing might add time.";
    affectingFactors = [
      "Complexity of electrical/mechanical failure",
      "Local availability of certified spare parts",
      "Outer unit accessibility (for AC and chimneys)"
    ];
    phases = [
      {
        name: "Diagnosis & Safety Checks",
        duration: `${setupMinutes} mins`,
        description: "Multi-point diagnostic run, safety voltage test, and failure trace."
      },
      {
        name: "Component Level Fixes",
        duration: `${activeMinutes} mins`,
        description: "Soldering, replacing damaged circuits/valves, and lubricating parts."
      },
      {
        name: "Post-Repair Load Testing",
        duration: `${cleanupMinutes} mins`,
        description: "Running a full load test cycle, double-checking wiring, and clear-up."
      }
    ];
  } else {
    // Default fallback
    affectingFactors = [
      "Accessibility of the task spot",
      "Urgency of custom requirements",
      "Underlying plumbing or wiring configurations"
    ];
    phases = [
      {
        name: "Diagnostic & Plan of Action",
        duration: `${setupMinutes} mins`,
        description: "On-site inspection, material mapping, and customer consultation."
      },
      {
        name: "Core Job Execution",
        duration: `${activeMinutes} mins`,
        description: "Precision craftsmanship handling and active assembly."
      },
      {
        name: "Testing & Handover",
        duration: `${cleanupMinutes} mins`,
        description: "Verifying standard compliance, clearing waste, and final walkthrough."
      }
    ];
  }

  // Format nice display string (e.g. "1 hr 45 mins" or "45 mins")
  let displayText = "";
  if (totalMinutes >= 60) {
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    displayText = `${hrs} ${hrs === 1 ? 'hr' : 'hrs'}${mins > 0 ? ` ${mins} mins` : ''}`;
  } else {
    displayText = `${totalMinutes} mins`;
  }

  return {
    totalMinutes,
    displayText,
    setupMinutes,
    activeMinutes,
    cleanupMinutes,
    expectationNote,
    phases,
    affectingFactors
  };
}
