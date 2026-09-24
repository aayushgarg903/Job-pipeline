// SPECIMEN supply side and employer voice. Every name here is fictional and carries "(specimen)";
// all rows are written with is_demo = true. Trade codes refer to data/trades.json.

export interface DemoInstitution { id: string; name: string; type: "ITI" | "PMKVY-TC"; lgd: string; town: string; ownership: "govt" | "private"; trades: string[]; modern?: boolean }

export const INSTITUTIONS: DemoInstitution[] = [
  // Pune (490): rich data, several modernised institutes
  { id: "iti-pune-aundh", name: "Govt ITI Aundh (specimen)", type: "ITI", lgd: "490", town: "Aundh", ownership: "govt", trades: ["CTS-ELEC", "CTS-FITT", "CTS-MACH", "CTS-COPA", "CTS-MEV", "CTS-SOLE"], modern: true },
  { id: "iti-pune-hadapsar", name: "Hadapsar Industrial ITI (specimen)", type: "ITI", lgd: "490", town: "Hadapsar", ownership: "private", trades: ["CTS-WELD", "CTS-MMV", "CTS-ELMC", "CTS-TDM"] },
  { id: "iti-pune-chakan", name: "Chakan MIDC Private ITI (specimen)", type: "ITI", lgd: "490", town: "Chakan", ownership: "private", trades: ["CTS-FITT", "CTS-TURN", "CTS-WELD"] },
  { id: "iti-pune-pimpri", name: "Pimpri-Chinchwad Govt ITI (specimen)", type: "ITI", lgd: "490", town: "Pimpri", ownership: "govt", trades: ["CTS-ELEC", "CTS-RACT", "CTS-DMEC", "CTS-COPA", "CTS-IOTS"], modern: true },
  { id: "iti-pune-baramati", name: "Baramati Govt ITI (specimen)", type: "ITI", lgd: "490", town: "Baramati", ownership: "govt", trades: ["CTS-ELEC", "CTS-WIRE", "CTS-MDSL"] },
  { id: "iti-pune-junnar", name: "Junnar Govt ITI (specimen)", type: "ITI", lgd: "490", town: "Junnar", ownership: "govt", trades: ["CTS-FPG", "CTS-ELEC", "CTS-STEN"] },
  { id: "pmk-pune-hinjewadi", name: "Hinjewadi Skill Centre (specimen)", type: "PMKVY-TC", lgd: "490", town: "Hinjewadi", ownership: "private", trades: ["PMK-JSD", "PMK-CCE", "PMK-DEO"], modern: true },
  { id: "pmk-pune-chakan", name: "Chakan Kaushal Kendra (specimen)", type: "PMKVY-TC", lgd: "490", town: "Chakan", ownership: "private", trades: ["PMK-CNCT", "PMK-FORK", "PMK-WHP"] },
  { id: "pmk-pune-hadapsar", name: "Hadapsar Health Skills Centre (specimen)", type: "PMKVY-TC", lgd: "490", town: "Hadapsar", ownership: "private", trades: ["PMK-GDA", "PMK-PHLB"] },
  { id: "pmk-pune-shirur", name: "Shirur Green Skills Centre (specimen)", type: "PMKVY-TC", lgd: "490", town: "Shirur", ownership: "private", trades: ["PMK-SURY", "PMK-EVCS"] },
  // Nashik (487): mixed; the hero Electrician course lacks solar PV and EV charging
  { id: "iti-nashik-satpur", name: "Satpur Govt ITI (specimen)", type: "ITI", lgd: "487", town: "Satpur", ownership: "govt", trades: ["CTS-ELEC", "CTS-FITT", "CTS-WELD", "CTS-COPA", "CTS-MMV"] },
  { id: "iti-nashik-ambad", name: "Ambad MIDC Private ITI (specimen)", type: "ITI", lgd: "487", town: "Ambad", ownership: "private", trades: ["CTS-MACH", "CTS-TURN", "CTS-ELEC", "CTS-TDM"] },
  { id: "iti-nashik-sinnar", name: "Sinnar Govt ITI (specimen)", type: "ITI", lgd: "487", town: "Sinnar", ownership: "govt", trades: ["CTS-MMV", "CTS-ELMC", "CTS-RACT"] },
  { id: "iti-nashik-malegaon", name: "Malegaon Govt ITI (specimen)", type: "ITI", lgd: "487", town: "Malegaon", ownership: "govt", trades: ["CTS-WELD", "CTS-WIRE", "CTS-STEN"] },
  { id: "iti-nashik-niphad", name: "Niphad Govt ITI (specimen)", type: "ITI", lgd: "487", town: "Niphad", ownership: "govt", trades: ["CTS-FPG", "CTS-ELEC"] },
  { id: "pmk-nashik-city", name: "Nashik City Skill Centre (specimen)", type: "PMKVY-TC", lgd: "487", town: "Nashik", ownership: "private", trades: ["PMK-GDA", "PMK-DEO", "PMK-CCE", "PMK-PHLB"] },
  { id: "pmk-nashik-dindori", name: "Dindori Agro Skills Centre (specimen)", type: "PMKVY-TC", lgd: "487", town: "Dindori", ownership: "private", trades: ["PMK-FVP", "PMK-FSS"] },
  { id: "pmk-nashik-igatpuri", name: "Igatpuri Kaushal Kendra (specimen)", type: "PMKVY-TC", lgd: "487", town: "Igatpuri", ownership: "private", trades: ["PMK-SURY", "PMK-WHP"] },
  // Gadchiroli (475): thin data, aspirational
  { id: "iti-gadchiroli", name: "Gadchiroli Govt ITI (specimen)", type: "ITI", lgd: "475", town: "Gadchiroli", ownership: "govt", trades: ["CTS-ELEC", "CTS-WIRE", "CTS-COPA", "CTS-FITT"] },
  { id: "iti-gadchiroli-aheri", name: "Aheri Govt ITI (specimen)", type: "ITI", lgd: "475", town: "Aheri", ownership: "govt", trades: ["CTS-WELD", "CTS-MMV"] },
  { id: "iti-gadchiroli-chamorshi", name: "Chamorshi Govt ITI (specimen)", type: "ITI", lgd: "475", town: "Chamorshi", ownership: "govt", trades: ["CTS-ELMC", "CTS-STEN"] },
  { id: "pmk-gadchiroli", name: "Gadchiroli Kaushal Kendra (specimen)", type: "PMKVY-TC", lgd: "475", town: "Gadchiroli", ownership: "private", trades: ["PMK-GDA", "PMK-DEO"] },
  { id: "pmk-gadchiroli-desaiganj", name: "Desaiganj Skill Centre (specimen)", type: "PMKVY-TC", lgd: "475", town: "Desaiganj", ownership: "private", trades: ["PMK-FVP", "PMK-SURY"] },
  // Spread across the state
  { id: "iti-csn-waluj", name: "Waluj MIDC Govt ITI (specimen)", type: "ITI", lgd: "469", town: "Waluj", ownership: "govt", trades: ["CTS-FITT", "CTS-WELD", "CTS-MACH", "CTS-ELEC", "CTS-SOLE"], modern: true },
  { id: "iti-csn-city", name: "Sambhajinagar City ITI (specimen)", type: "ITI", lgd: "469", town: "Chh. Sambhajinagar", ownership: "private", trades: ["CTS-MMV", "CTS-TDM", "CTS-COPA"] },
  { id: "pmk-csn-shendra", name: "Shendra Auto Skills Centre (specimen)", type: "PMKVY-TC", lgd: "469", town: "Shendra", ownership: "private", trades: ["PMK-CNCT", "PMK-EVCS"] },
  { id: "iti-nagpur-hingna", name: "Hingna Govt ITI (specimen)", type: "ITI", lgd: "484", town: "Hingna", ownership: "govt", trades: ["CTS-ELEC", "CTS-FITT", "CTS-RACT", "CTS-MEV"], modern: true },
  { id: "pmk-nagpur-mihan", name: "MIHAN Logistics Skills Centre (specimen)", type: "PMKVY-TC", lgd: "484", town: "MIHAN", ownership: "private", trades: ["PMK-WHP", "PMK-FORK", "PMK-CCE"] },
  { id: "iti-nagpur-city", name: "Nagpur Tech ITI (specimen)", type: "ITI", lgd: "484", town: "Nagpur", ownership: "private", trades: ["CTS-IOTS", "CTS-DRON", "CTS-COPA"] },
  { id: "iti-thane-wagle", name: "Wagle Estate Govt ITI (specimen)", type: "ITI", lgd: "497", town: "Thane", ownership: "govt", trades: ["CTS-ELEC", "CTS-ELMC", "CTS-FITT", "CTS-COPA"] },
  { id: "pmk-thane-bhiwandi", name: "Bhiwandi Warehousing Skills Centre (specimen)", type: "PMKVY-TC", lgd: "497", town: "Bhiwandi", ownership: "private", trades: ["PMK-WHP", "PMK-FORK"] },
  { id: "iti-kolhapur", name: "Kolhapur Govt ITI (specimen)", type: "ITI", lgd: "480", town: "Kolhapur", ownership: "govt", trades: ["CTS-FITT", "CTS-TURN", "CTS-WELD", "CTS-ELEC"] },
  { id: "pmk-kolhapur-ichalkaranji", name: "Ichalkaranji Skill Centre (specimen)", type: "PMKVY-TC", lgd: "480", town: "Ichalkaranji", ownership: "private", trades: ["PMK-FVP", "PMK-DEO"] },
  { id: "pmk-mumbai-andheri", name: "Andheri Skills Hub (specimen)", type: "PMKVY-TC", lgd: "483", town: "Andheri", ownership: "private", trades: ["PMK-GDA", "PMK-PHLB", "PMK-JSD", "PMK-CCE"], modern: true },
  { id: "iti-solapur", name: "Solapur Govt ITI (specimen)", type: "ITI", lgd: "496", town: "Solapur", ownership: "govt", trades: ["CTS-ELEC", "CTS-WELD", "CTS-COPA"] },
  { id: "iti-satara-karad", name: "Karad Govt ITI (specimen)", type: "ITI", lgd: "494", town: "Karad", ownership: "govt", trades: ["CTS-MMV", "CTS-MDSL"] },
  { id: "iti-jalgaon", name: "Jalgaon Govt ITI (specimen)", type: "ITI", lgd: "478", town: "Jalgaon", ownership: "govt", trades: ["CTS-ELEC", "CTS-FPG"] },
  { id: "pmk-latur", name: "Latur Agro Skills Centre (specimen)", type: "PMKVY-TC", lgd: "481", town: "Latur", ownership: "private", trades: ["PMK-FSS", "PMK-FVP"] },
  { id: "iti-amravati", name: "Amravati Govt ITI (specimen)", type: "ITI", lgd: "468", town: "Amravati", ownership: "govt", trades: ["CTS-FITT", "CTS-COPA"] },
  { id: "iti-nandurbar", name: "Nandurbar Govt ITI (specimen)", type: "ITI", lgd: "486", town: "Nandurbar", ownership: "govt", trades: ["CTS-WIRE", "CTS-STEN"] },
];

/** Base 6-month placement by trade (before district and institute modifiers). */
export const BASE_PLACEMENT: Record<string, number> = {
  "CTS-ELEC": 0.62, "CTS-WIRE": 0.5, "CTS-FITT": 0.6, "CTS-TURN": 0.55, "CTS-MACH": 0.6, "CTS-WELD": 0.58, "CTS-MMV": 0.5,
  "CTS-MDSL": 0.5, "CTS-MEV": 0.7, "CTS-ELMC": 0.35, "CTS-RACT": 0.55, "CTS-DMEC": 0.4, "CTS-TDM": 0.6, "CTS-SOLE": 0.6,
  "CTS-COPA": 0.28, "CTS-IOTS": 0.5, "CTS-DRON": 0.45, "CTS-FPG": 0.45, "CTS-HSI": 0.4, "CTS-STEN": 0.2, "PMK-GDA": 0.6,
  "PMK-PHLB": 0.55, "PMK-WHP": 0.55, "PMK-FORK": 0.6, "PMK-SURY": 0.58, "PMK-CNCT": 0.65, "PMK-DEO": 0.3, "PMK-CCE": 0.45,
  "PMK-JSD": 0.4, "PMK-FSS": 0.5, "PMK-FVP": 0.45, "PMK-EVCS": 0.62,
};
export const SECTOR_WAGE: Record<string, number> = { auto: 15000, electrical: 14000, it: 16000, logistics: 13000, food: 11000, health: 12000 };

/** Modernised institutes teach these on top of the NCVT syllabus (skillId, proficiency, hours). */
export const MODERN_EXTRAS: Record<string, Array<[string, number, number]>> = {
  "CTS-ELEC": [["solar-pv-installation", 2, 60], ["ev-charging-installation", 2, 40], ["plc-programming", 2, 60]],
  "CTS-COPA": [["data-analysis", 2, 80], ["ms-excel-advanced", 2, 60]],
  "CTS-FITT": [["industrial-automation", 1, 40]],
  "CTS-MACH": [["fanuc-cnc-control", 2, 60]],
  "PMK-JSD": [["cloud-computing", 1, 40], ["react", 1, 40]],
  "PMK-CCE": [["crm-software", 3, 20]],
};
/** Legacy modules modern institutes drop. */
export const MODERN_DROPS: Record<string, string[]> = { "CTS-COPA": ["dos-basic-computing", "typewriting"], "CTS-ELEC": ["motor-rewinding"] };

export interface DemoSurvey { employer: string; lgd: string; nco: string; sector: string; hires: number; skills: Array<[string, "mandatory" | "preferred" | "nice", number]>; comment: string | null }

export const SURVEYS: DemoSurvey[] = [
  // Nashik: electrical employers rank solar PV + EV charging Mandatory (demo step 3)
  { employer: "Godavari Solar Systems (specimen)", lgd: "487", nco: "7411.0100", sector: "electrical", hires: 18, skills: [["solar-pv-installation", "mandatory", 3], ["electrical-installation", "mandatory", 3], ["electrical-safety", "mandatory", 3], ["rooftop-solar", "preferred", 2]], comment: "ITI electricians need 2-3 months of solar training before they can go on a roof." },
  { employer: "Satpur Switchgear Works (specimen)", lgd: "487", nco: "7411.0100", sector: "electrical", hires: 12, skills: [["motor-control-panels", "mandatory", 3], ["plc-programming", "preferred", 2], ["ev-charging-installation", "mandatory", 2]], comment: "EV charger installs are now a third of our field jobs." },
  { employer: "Ambad EV Components (specimen)", lgd: "487", nco: "7411.0400", sector: "electrical", hires: 10, skills: [["ev-charging-installation", "mandatory", 3], ["high-voltage-safety", "mandatory", 3], ["multimeter-use", "mandatory", 2]], comment: null },
  { employer: "Nashik Rooftop Energy (specimen)", lgd: "487", nco: "7411.0300", sector: "electrical", hires: 15, skills: [["solar-pv-installation", "mandatory", 3], ["solar-inverter", "mandatory", 2], ["earthing-systems", "preferred", 2]], comment: "PM Surya Ghar orders doubled this year." },
  { employer: "Sinnar Electricals (specimen)", lgd: "487", nco: "7411.0100", sector: "electrical", hires: 8, skills: [["solar-pv-installation", "mandatory", 2], ["domestic-wiring", "mandatory", 3], ["electrical-drawing", "nice", 2]], comment: null },
  { employer: "Igatpuri Power Services (specimen)", lgd: "487", nco: "7411.0100", sector: "electrical", hires: 6, skills: [["ev-charging-installation", "mandatory", 2], ["transformer-maintenance", "preferred", 2]], comment: null },
  { employer: "Nashik Valley Agro Foods (specimen)", lgd: "487", nco: "7514.0100", sector: "food", hires: 25, skills: [["fruit-vegetable-processing", "mandatory", 2], ["food-safety-haccp", "mandatory", 2], ["cold-chain-management", "preferred", 2]], comment: "Grape and onion season needs trained pack-house staff." },
  { employer: "Dindori Winery Services (specimen)", lgd: "487", nco: "8160.0200", sector: "food", hires: 9, skills: [["wine-beverage-production", "mandatory", 2], ["gmp-hygiene", "mandatory", 2]], comment: null },
  { employer: "Ambad Precision Tools (specimen)", lgd: "487", nco: "7223.0200", sector: "auto", hires: 14, skills: [["cnc-machine-operation", "mandatory", 3], ["fanuc-cnc-control", "mandatory", 2], ["precision-measurement", "mandatory", 3]], comment: null },
  { employer: "Nashik City Hospital Group (specimen)", lgd: "487", nco: "5321.0100", sector: "health", hires: 20, skills: [["patient-care", "mandatory", 2], ["infection-control", "mandatory", 2], ["first-aid-cpr", "preferred", 2]], comment: null },
  // Pune
  { employer: "Chakan Forge & Machining (specimen)", lgd: "490", nco: "7223.0200", sector: "auto", hires: 40, skills: [["cnc-machine-operation", "mandatory", 3], ["cnc-programming", "mandatory", 2], ["fanuc-cnc-control", "mandatory", 2], ["gd-and-t", "preferred", 2]], comment: "We hire 40 CNC operators a year and retrain most of them." },
  { employer: "Talegaon Auto Assemblies (specimen)", lgd: "490", nco: "7233.0100", sector: "auto", hires: 30, skills: [["fitting-assembly", "mandatory", 3], ["hydraulics-pneumatics", "mandatory", 2], ["five-s-kaizen", "preferred", 2]], comment: null },
  { employer: "Bhosari Welding Works (specimen)", lgd: "490", nco: "7212.0100", sector: "auto", hires: 16, skills: [["mig-mag-welding", "mandatory", 3], ["robotic-welding", "preferred", 2], ["arc-welding", "mandatory", 3]], comment: "Robotic cells are coming; manual MIG still dominates." },
  { employer: "Hinjewadi Analytics (specimen)", lgd: "490", nco: "2120.0100", sector: "it", hires: 25, skills: [["data-analysis", "mandatory", 3], ["sql", "mandatory", 3], ["power-bi", "mandatory", 2], ["python", "preferred", 2]], comment: null },
  { employer: "Kharadi Cloud Services (specimen)", lgd: "490", nco: "3511.0100", sector: "it", hires: 18, skills: [["cloud-computing", "mandatory", 2], ["linux-administration", "mandatory", 2], ["networking", "preferred", 2]], comment: null },
  { employer: "Chakan EV Drivetrain (specimen)", lgd: "490", nco: "7231.0300", sector: "auto", hires: 22, skills: [["ev-battery-systems", "mandatory", 3], ["battery-management-systems", "mandatory", 2], ["high-voltage-safety", "mandatory", 3]], comment: "Battery management is the hardest skill to find." },
  { employer: "Pune Metro Electricals (specimen)", lgd: "490", nco: "7411.0100", sector: "electrical", hires: 20, skills: [["electrical-installation", "mandatory", 3], ["plc-programming", "preferred", 2], ["solar-pv-installation", "preferred", 2]], comment: null },
  { employer: "Ranjangaon Warehousing (specimen)", lgd: "490", nco: "4321.0200", sector: "logistics", hires: 15, skills: [["wms-software", "mandatory", 2], ["inventory-management", "mandatory", 2], ["ms-excel", "mandatory", 2]], comment: null },
  { employer: "Hadapsar Multispeciality (specimen)", lgd: "490", nco: "3212.0100", sector: "health", hires: 12, skills: [["lab-sample-processing", "mandatory", 3], ["hematology", "preferred", 2], ["clinical-biochemistry", "preferred", 2]], comment: null },
  { employer: "Pune Office Services (specimen)", lgd: "490", nco: "4132.0100", sector: "it", hires: 4, skills: [["data-entry", "mandatory", 2], ["ms-excel", "mandatory", 2]], comment: "We need fewer data-entry staff every year; automation took most of it." },
  { employer: "Wakad Customer Hub (specimen)", lgd: "490", nco: "4222.0100", sector: "it", hires: 30, skills: [["customer-support", "mandatory", 2], ["english-communication", "mandatory", 3], ["crm-software", "preferred", 2]], comment: null },
  { employer: "Shirur Solar Parks (specimen)", lgd: "490", nco: "7411.0300", sector: "electrical", hires: 14, skills: [["solar-pv-installation", "mandatory", 3], ["solar-inverter", "mandatory", 3]], comment: null },
  // Gadchiroli: few employers, surveys carry the signal
  { employer: "Gadchiroli District Hospital Services (specimen)", lgd: "475", nco: "5321.0100", sector: "health", hires: 15, skills: [["patient-care", "mandatory", 2], ["first-aid-cpr", "mandatory", 2], ["marathi-communication", "mandatory", 3]], comment: "We cannot retain nurses; GDAs trained locally stay." },
  { employer: "Wainganga Forest Produce (specimen)", lgd: "475", nco: "7514.0100", sector: "food", hires: 12, skills: [["fruit-vegetable-processing", "mandatory", 2], ["post-harvest-management", "preferred", 2], ["gmp-hygiene", "mandatory", 1]], comment: "Mahua and bamboo processing units are expanding." },
  { employer: "Desaiganj Rice Mills (specimen)", lgd: "475", nco: "8160.0100", sector: "food", hires: 8, skills: [["grain-milling", "mandatory", 2], ["preventive-maintenance", "preferred", 2]], comment: null },
  { employer: "Aheri Solar Pumps (specimen)", lgd: "475", nco: "7411.0300", sector: "electrical", hires: 6, skills: [["solar-pv-installation", "mandatory", 2], ["domestic-wiring", "mandatory", 2]], comment: "Solar pump installs under PM-KUSUM need local technicians." },
  // Chh. Sambhajinagar
  { employer: "Waluj Auto Components (specimen)", lgd: "469", nco: "7212.0100", sector: "auto", hires: 20, skills: [["mig-mag-welding", "mandatory", 3], ["robotic-welding", "mandatory", 2], ["quality-inspection", "preferred", 2]], comment: null },
  { employer: "Shendra EV Park Tenants (specimen)", lgd: "469", nco: "7231.0300", sector: "auto", hires: 25, skills: [["ev-powertrain", "mandatory", 3], ["battery-management-systems", "mandatory", 2], ["vehicle-diagnostics", "mandatory", 2]], comment: null },
  { employer: "Paithan Road Pharma (specimen)", lgd: "469", nco: "3213.0100", sector: "health", hires: 10, skills: [["pharmacy-dispensing", "mandatory", 2], ["drug-inventory", "mandatory", 2]], comment: null },
  { employer: "Chikalthana Logistics (specimen)", lgd: "469", nco: "8344.0100", sector: "logistics", hires: 9, skills: [["forklift-operation", "mandatory", 3], ["workplace-safety", "mandatory", 3]], comment: null },
];
