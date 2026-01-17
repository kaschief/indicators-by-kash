import { useState, useMemo } from "react";

// =============================================================================
// GERMANY TAX CONSTANTS 2026
// =============================================================================
// Sources:
// - Income Tax: https://www.bundesfinanzministerium.de (EStG §32a)
// - 2026 Changes: https://perfinex.de/germany-2026-tax-changes/
// - Social Security: https://www.tk.de/en/become-a-member/join-tk/contribution-rate-social-security-2037092
// - Contribution Ceilings: https://germanpedia.com/contribution-assessment-ceiling-germany/
// - 2026 Ceilings: https://ogletree.com/insights-resources/blog-posts/germany-increases-social-security-contribution-and-compulsory-insurance-ceilings-effective-january-1-2026/
// =============================================================================

// Income Tax Brackets (Einkommensteuer) - 2026
const TAX_FREE_ALLOWANCE = 12348; // Grundfreibetrag (single) - up from €12,096 in 2025
const ZONE_2_END = 17443; // End of 14-24% progressive zone
const ZONE_3_END = 69000; // End of 24-42% progressive zone - up from €66,760 in 2025
const ZONE_4_END = 277825; // End of 42% flat zone (Reichensteuer threshold)
const TOP_TAX_RATE = 0.45; // Reichensteuer (45%)
const HIGH_TAX_RATE = 0.42; // Spitzensteuersatz (42%)

// Zone formula coefficients (from BMF Programmablaufplan)
const ZONE_2_COEF_A = 922.98;
const ZONE_2_COEF_B = 1400;
const ZONE_3_COEF_A = 176.02;
const ZONE_3_COEF_B = 2397;
const ZONE_3_OFFSET = 1015.13;
const ZONE_4_OFFSET = 10602.13;
const ZONE_5_OFFSET = 18936.88;

// Solidarity Surcharge (Solidaritätszuschlag)
const SOLI_RATE = 0.055; // 5.5% of income tax
const SOLI_THRESHOLD = 18130; // Only charged above this income tax amount

// Church Tax (Kirchensteuer)
const CHURCH_TAX_RATE = 0.09; // 9% (8% in Bavaria/Baden-Württemberg)

// Health Insurance (Krankenversicherung) - 2026
const HEALTH_INSURANCE_BASE_RATE = 0.146; // 14.6% base rate
const HEALTH_INSURANCE_ADDITIONAL = 0.025; // ~2.5% average Zusatzbeitrag
const HEALTH_INSURANCE_TOTAL =
  HEALTH_INSURANCE_BASE_RATE + HEALTH_INSURANCE_ADDITIONAL;

// Care Insurance (Pflegeversicherung) - 2026
const CARE_INSURANCE_RATE = 0.036; // 3.6% base (4.2% for childless 23+)

// Pension Insurance (Rentenversicherung) - 2026
const PENSION_INSURANCE_RATE = 0.186; // 18.6% total (employee pays half)

// Unemployment Insurance (Arbeitslosenversicherung) - 2026
const UNEMPLOYMENT_INSURANCE_RATE = 0.026; // 2.6% total (employee pays half)

// Contribution Ceilings (Beitragsbemessungsgrenzen) - 2026
const HEALTH_INSURANCE_CEILING = 69750; // Annual ceiling for health/care
const PENSION_INSURANCE_CEILING = 101400; // Annual ceiling for pension (West)

export default function IncomeTracker() {
  const [mode, setMode] = useState("monthly");
  const [monthlyTarget, setMonthlyTarget] = useState("7500");
  const [dailyTarget, setDailyTarget] = useState("");
  const [tradingDaysPerWeek, setTradingDaysPerWeek] = useState("3");
  const [propFirmAccounts, setPropFirmAccounts] = useState("1");
  const [tradesPerDay, setTradesPerDay] = useState("1");
  const [hoursPerDay, setHoursPerDay] = useState("5");
  const [contracts, setContracts] = useState("1");
  const [tickValue, setTickValue] = useState("0.50");
  const [ticksPerPoint, setTicksPerPoint] = useState("4");
  const [hasChurchTax, setHasChurchTax] = useState(false);
  const [monthlyExpenses, setMonthlyExpenses] = useState("2000");
  const [employmentMode, setEmploymentMode] = useState<
    "freelancer" | "employed"
  >("freelancer");
  const [isMarried, setIsMarried] = useState(false);

  // German income tax calculation (2026 brackets) with Ehegattensplitting
  const calculateGermanIncomeTax = (
    taxableIncome: number,
    married: boolean
  ): number => {
    const splitIncome = married ? taxableIncome / 2 : taxableIncome;

    let tax: number;
    if (splitIncome <= TAX_FREE_ALLOWANCE) {
      tax = 0;
    } else if (splitIncome <= ZONE_2_END) {
      const y = (splitIncome - TAX_FREE_ALLOWANCE) / 10000;
      tax = (ZONE_2_COEF_A * y + ZONE_2_COEF_B) * y;
    } else if (splitIncome <= ZONE_3_END) {
      const z = (splitIncome - ZONE_2_END) / 10000;
      tax = (ZONE_3_COEF_A * z + ZONE_3_COEF_B) * z + ZONE_3_OFFSET;
    } else if (splitIncome <= ZONE_4_END) {
      tax = HIGH_TAX_RATE * splitIncome - ZONE_4_OFFSET;
    } else {
      tax = TOP_TAX_RATE * splitIncome - ZONE_5_OFFSET;
    }

    return married ? tax * 2 : tax;
  };

  const calculations = useMemo(() => {
    const daysPerWeek = parseFloat(tradingDaysPerWeek) || 0;
    const accounts = parseFloat(propFirmAccounts) || 1;
    const trades = parseFloat(tradesPerDay) || 1;
    const hours = parseFloat(hoursPerDay) || 1;
    const numContracts = parseFloat(contracts) || 1;
    const tickVal = parseFloat(tickValue) || 0.5;
    const tpp = parseFloat(ticksPerPoint) || 4;

    const tradingDaysPerMonth = Math.min(16, daysPerWeek * 4);

    let monthly, daily;
    if (mode === "monthly") {
      monthly = parseFloat(monthlyTarget) || 0;
      daily = tradingDaysPerMonth > 0 ? monthly / tradingDaysPerMonth : 0;
    } else {
      daily = parseFloat(dailyTarget) || 0;
      monthly = daily * tradingDaysPerMonth;
    }

    const annual = monthly * 12;
    const weekly = monthly / 4;
    const perAccount = accounts > 0 ? daily / accounts : 0;
    const perTrade = trades > 0 ? perAccount / trades : 0;
    const hourlyRate = hours > 0 ? daily / hours : 0;

    const ticksPerDay = tickVal > 0 ? perAccount / (tickVal * numContracts) : 0;
    const ticksPerTrade =
      trades > 0 && tickVal > 0 ? perTrade / (tickVal * numContracts) : 0;
    const pointsPerDay = tpp > 0 ? ticksPerDay / tpp : 0;
    const pointsPerTrade = tpp > 0 ? ticksPerTrade / tpp : 0;

    // === GERMAN TAX CALCULATIONS (2026) ===
    const grossAnnual = annual;
    const isFreelancer = employmentMode === "freelancer";

    const healthCareBase = Math.min(grossAnnual, HEALTH_INSURANCE_CEILING);
    const pensionBase = Math.min(grossAnnual, PENSION_INSURANCE_CEILING);

    let annualHealthInsurance: number;
    let annualCareInsurance: number;
    let annualPensionInsurance: number;
    let annualUnemploymentInsurance: number;

    if (isFreelancer) {
      annualHealthInsurance = healthCareBase * HEALTH_INSURANCE_TOTAL;
      annualCareInsurance = healthCareBase * CARE_INSURANCE_RATE;
      annualPensionInsurance = 0;
      annualUnemploymentInsurance = 0;
    } else {
      annualHealthInsurance = healthCareBase * (HEALTH_INSURANCE_TOTAL / 2);
      annualCareInsurance = healthCareBase * (CARE_INSURANCE_RATE / 2);
      annualPensionInsurance = pensionBase * (PENSION_INSURANCE_RATE / 2);
      annualUnemploymentInsurance =
        pensionBase * (UNEMPLOYMENT_INSURANCE_RATE / 2);
    }

    const totalSocialSecurity =
      annualHealthInsurance +
      annualCareInsurance +
      annualPensionInsurance +
      annualUnemploymentInsurance;

    const deductibleInsurance = annualHealthInsurance + annualCareInsurance;
    const taxableIncome = Math.max(0, grossAnnual - deductibleInsurance);

    const incomeTax = calculateGermanIncomeTax(taxableIncome, isMarried);
    const solidaritySurcharge =
      incomeTax > SOLI_THRESHOLD ? incomeTax * SOLI_RATE : 0;
    const churchTax = hasChurchTax ? incomeTax * CHURCH_TAX_RATE : 0;

    const totalTax = incomeTax + solidaritySurcharge + churchTax;
    const totalDeductions = totalTax + totalSocialSecurity;

    const netAnnual = grossAnnual - totalDeductions;
    const netMonthly = netAnnual / 12;
    const effectiveTaxRate =
      grossAnnual > 0 ? (totalDeductions / grossAnnual) * 100 : 0;

    const expenses = parseFloat(monthlyExpenses) || 0;
    const disposableMonthly = netMonthly - expenses;
    const disposableAnnual = disposableMonthly * 12;

    // Monthly breakdown
    const monthlyIncomeTax = incomeTax / 12;
    const monthlySolidaritySurcharge = solidaritySurcharge / 12;
    const monthlyChurchTax = churchTax / 12;
    const monthlyHealthInsurance = annualHealthInsurance / 12;
    const monthlyCareInsurance = annualCareInsurance / 12;
    const monthlyPensionInsurance = annualPensionInsurance / 12;
    const monthlyUnemploymentInsurance = annualUnemploymentInsurance / 12;
    const monthlyTotalDeductions = totalDeductions / 12;

    return {
      tradingDaysPerMonth,
      annual,
      weekly,
      monthly,
      daily,
      perAccount,
      trades,
      perTrade,
      hourlyRate,
      ticksPerDay,
      ticksPerTrade,
      pointsPerDay,
      pointsPerTrade,
      incomeTax,
      solidaritySurcharge,
      churchTax,
      annualHealthInsurance,
      annualCareInsurance,
      annualPensionInsurance,
      annualUnemploymentInsurance,
      totalSocialSecurity,
      totalDeductions,
      netAnnual,
      netMonthly,
      effectiveTaxRate,
      disposableMonthly,
      disposableAnnual,
      monthlyIncomeTax,
      monthlySolidaritySurcharge,
      monthlyChurchTax,
      monthlyHealthInsurance,
      monthlyCareInsurance,
      monthlyPensionInsurance,
      monthlyUnemploymentInsurance,
      monthlyTotalDeductions,
    };
  }, [
    mode,
    monthlyTarget,
    dailyTarget,
    tradingDaysPerWeek,
    propFirmAccounts,
    tradesPerDay,
    hoursPerDay,
    contracts,
    tickValue,
    ticksPerPoint,
    hasChurchTax,
    monthlyExpenses,
    employmentMode,
    isMarried,
    calculateGermanIncomeTax,
  ]);

  const formatNumber = (num: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);

  // Calculate net for a given gross monthly (for comparison table)
  const calculateNetForGross = (
    grossMonthly: number
  ): {
    grossMonthly: number;
    netMonthly: number;
    grossAnnual: number;
    netAnnual: number;
    rate: number;
  } => {
    const grossAnnual = grossMonthly * 12;
    const isFreelancer = employmentMode === "freelancer";

    const healthCareBase = Math.min(grossAnnual, HEALTH_INSURANCE_CEILING);
    const pensionBase = Math.min(grossAnnual, PENSION_INSURANCE_CEILING);

    const healthIns = isFreelancer
      ? healthCareBase * HEALTH_INSURANCE_TOTAL
      : healthCareBase * (HEALTH_INSURANCE_TOTAL / 2);
    const careIns = isFreelancer
      ? healthCareBase * CARE_INSURANCE_RATE
      : healthCareBase * (CARE_INSURANCE_RATE / 2);
    const pensionIns = isFreelancer
      ? 0
      : pensionBase * (PENSION_INSURANCE_RATE / 2);
    const unemploymentIns = isFreelancer
      ? 0
      : pensionBase * (UNEMPLOYMENT_INSURANCE_RATE / 2);

    const totalSocial = healthIns + careIns + pensionIns + unemploymentIns;
    const taxableIncome = Math.max(0, grossAnnual - healthIns - careIns);

    const incomeTax = calculateGermanIncomeTax(taxableIncome, isMarried);
    const soli = incomeTax > SOLI_THRESHOLD ? incomeTax * SOLI_RATE : 0;
    const church = hasChurchTax ? incomeTax * CHURCH_TAX_RATE : 0;

    const totalDeductions = incomeTax + soli + church + totalSocial;
    const netAnnual = grossAnnual - totalDeductions;
    const effectiveRate =
      grossAnnual > 0 ? (totalDeductions / grossAnnual) * 100 : 0;

    return {
      grossMonthly,
      netMonthly: netAnnual / 12,
      grossAnnual,
      netAnnual,
      rate: effectiveRate,
    };
  };

  // Generate comparison levels (2 below, current, 2 above)
  const comparisonLevels = useMemo(() => {
    const step = 1500; // €2,000 increments
    const current = calculations.monthly;
    const levels = [
      Math.max(1, current - step * 2),
      Math.max(1, current - step),
      current,
      current + step,
      current + step * 2,
    ];
    // Filter out duplicates (can happen at very low incomes)
    const unique = [...new Set(levels)];
    return unique.map(calculateNetForGross);
  }, [
    calculations.monthly,
    employmentMode,
    isMarried,
    hasChurchTax,
    calculateGermanIncomeTax,
  ]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-4 font-mono">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 border-b border-gray-800 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
            <h1 className="text-xl font-semibold text-white">
              Kash's Income Tracker
            </h1>
          </div>
          <p className="text-gray-500 text-xs ml-5">Daily Targets Calculator</p>
        </div>

        <div className="flex flex-wrap gap-4">
          {/* LEFT: Trading Calculator */}
          <div className="flex-1 min-w-[320px] space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-gray-500">
                  Targets
                </div>
                <div className="flex gap-1 bg-gray-950 rounded p-1">
                  <button
                    onClick={() => setMode("monthly")}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      mode === "monthly"
                        ? "bg-green-500/20 text-green-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}>
                    Monthly →
                  </button>
                  <button
                    onClick={() => setMode("daily")}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      mode === "daily"
                        ? "bg-blue-500/20 text-blue-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}>
                    Daily →
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                {mode === "monthly" ? (
                  <div>
                    <label className="block text-xs text-green-400 mb-1">
                      Monthly Target
                    </label>
                    <input
                      type="number"
                      value={monthlyTarget}
                      onChange={(e) => setMonthlyTarget(e.target.value)}
                      className="bg-gray-950 border border-green-500/30 rounded px-3 py-2 text-white text-base font-semibold text-center w-24 focus:outline-none focus:border-green-500"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-blue-400 mb-1">
                      Daily Target
                    </label>
                    <input
                      type="number"
                      value={dailyTarget}
                      onChange={(e) => setDailyTarget(e.target.value)}
                      className="bg-gray-950 border border-blue-500/30 rounded px-3 py-2 text-white text-base font-semibold text-center w-24 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Days/Week
                  </label>
                  <input
                    type="number"
                    value={tradingDaysPerWeek}
                    onChange={(e) => setTradingDaysPerWeek(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Accounts
                  </label>
                  <input
                    type="number"
                    value={propFirmAccounts}
                    onChange={(e) => setPropFirmAccounts(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Trades/Day
                  </label>
                  <input
                    type="number"
                    value={tradesPerDay}
                    onChange={(e) => setTradesPerDay(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Hours/Day
                  </label>
                  <input
                    type="number"
                    value={hoursPerDay}
                    onChange={(e) => setHoursPerDay(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500/10 to-blue-500/5 border border-green-500/20 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                    Annual
                  </div>
                  <div className="text-xl font-semibold text-green-400">
                    {formatNumber(calculations.annual)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                    Weekly
                  </div>
                  <div className="text-xl font-semibold text-green-400">
                    {formatNumber(calculations.weekly)}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                    {mode === "daily" ? "Monthly (calc)" : "Daily"}
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      mode === "daily" ? "text-green-400" : "text-white"
                    }`}>
                    {formatNumber(
                      mode === "daily"
                        ? calculations.monthly
                        : calculations.daily
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {calculations.tradingDaysPerMonth} days/mo
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                    Per Account
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {formatNumber(calculations.perAccount)}
                  </div>
                  <div className="text-xs text-gray-500">
                    ×{propFirmAccounts || 1} accounts
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                  Per Trade
                </div>
                <div className="text-2xl font-bold text-amber-400">
                  {formatNumber(calculations.perTrade)}
                </div>
                <div className="text-xs text-gray-500">
                  {tradesPerDay || 1}{" "}
                  {(parseFloat(tradesPerDay) || 1) === 1 ? "trade" : "trades"}
                  {(parseFloat(propFirmAccounts) || 1) > 1
                    ? ` × ${propFirmAccounts} accounts`
                    : ""}
                </div>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
                  Hourly Rate
                </div>
                <div className="text-2xl font-bold text-purple-400">
                  {formatNumber(calculations.hourlyRate)}
                </div>
                <div className="text-xs text-gray-500">
                  {hoursPerDay || 1}h/day
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                Futures Calculator
              </div>
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Contracts
                  </label>
                  <input
                    type="number"
                    value={contracts}
                    onChange={(e) => setContracts(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Tick Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tickValue}
                    onChange={(e) => setTickValue(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-20 focus:outline-none focus:border-gray-600"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Ticks/Point
                  </label>
                  <input
                    type="number"
                    value={ticksPerPoint}
                    onChange={(e) => setTicksPerPoint(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-16 focus:outline-none focus:border-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Per Day</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {calculations.pointsPerDay.toFixed(1)}{" "}
                    <span className="text-sm text-gray-500">pts</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.ceil(calculations.ticksPerDay)} ticks
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Per Trade</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {calculations.pointsPerTrade.toFixed(1)}{" "}
                    <span className="text-sm text-gray-500">pts</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {Math.ceil(calculations.ticksPerTrade)} ticks
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Tax Calculator */}
          <div className="flex-1 min-w-[400px] space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="text-xs uppercase tracking-wider text-gray-500">
                  Germany Tax (2026)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1 bg-gray-950 rounded p-1">
                    <button
                      onClick={() => setEmploymentMode("freelancer")}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        employmentMode === "freelancer"
                          ? "bg-orange-500/20 text-orange-400"
                          : "text-gray-500 hover:text-gray-300"
                      }`}>
                      Freelancer
                    </button>
                    <button
                      onClick={() => setEmploymentMode("employed")}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        employmentMode === "employed"
                          ? "bg-blue-500/20 text-blue-400"
                          : "text-gray-500 hover:text-gray-300"
                      }`}>
                      Employed IV
                    </button>
                  </div>
                  <div className="flex gap-1 bg-gray-950 rounded p-1">
                    <button
                      onClick={() => setIsMarried(false)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        !isMarried
                          ? "bg-gray-500/20 text-gray-300"
                          : "text-gray-500 hover:text-gray-300"
                      }`}>
                      Single
                    </button>
                    <button
                      onClick={() => setIsMarried(true)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        isMarried
                          ? "bg-pink-500/20 text-pink-400"
                          : "text-gray-500 hover:text-gray-300"
                      }`}>
                      Married
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-gray-500">Church</span>
                    <div
                      onClick={() => setHasChurchTax(!hasChurchTax)}
                      className={`w-8 h-4 rounded-full transition-colors ${
                        hasChurchTax ? "bg-purple-500" : "bg-gray-700"
                      }`}>
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          hasChurchTax ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Gross Annual</div>
                  <div className="text-xl font-bold text-white">
                    €{formatNumber(calculations.annual)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Gross Monthly
                  </div>
                  <div className="text-xl font-bold text-white">
                    €{formatNumber(calculations.monthly)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Effective Rate
                  </div>
                  <div className="text-xl font-bold text-red-400">
                    {calculations.effectiveTaxRate.toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex text-xs text-gray-600 uppercase tracking-wider mb-1">
                  <span className="flex-1">
                    Taxes {isMarried && "(Splitting)"}
                  </span>
                  <span className="w-28 text-right">Annual</span>
                  <span className="w-24 text-right">Monthly</span>
                </div>
                <div className="flex text-gray-400">
                  <span className="flex-1">Income Tax</span>
                  <span className="w-28 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.incomeTax)}
                  </span>
                  <span className="w-24 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.monthlyIncomeTax)}
                  </span>
                </div>
                {calculations.solidaritySurcharge > 0 && (
                  <div className="flex text-gray-400">
                    <span className="flex-1">Solidarity</span>
                    <span className="w-28 text-right whitespace-nowrap">
                      −€{formatNumber(calculations.solidaritySurcharge)}
                    </span>
                    <span className="w-24 text-right whitespace-nowrap">
                      −€{formatNumber(calculations.monthlySolidaritySurcharge)}
                    </span>
                  </div>
                )}
                {calculations.churchTax > 0 && (
                  <div className="flex text-gray-400">
                    <span className="flex-1">Church Tax</span>
                    <span className="w-28 text-right whitespace-nowrap">
                      −€{formatNumber(calculations.churchTax)}
                    </span>
                    <span className="w-24 text-right whitespace-nowrap">
                      −€{formatNumber(calculations.monthlyChurchTax)}
                    </span>
                  </div>
                )}

                <div className="flex text-xs text-gray-600 uppercase tracking-wider mb-1 mt-3">
                  <span className="flex-1">
                    Social Security{" "}
                    {employmentMode === "employed" && "(your 50%)"}
                  </span>
                  <span className="w-28 text-right">Annual</span>
                  <span className="w-24 text-right">Monthly</span>
                </div>
                <div className="flex text-gray-400">
                  <span className="flex-1">Health</span>
                  <span className="w-28 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.annualHealthInsurance)}
                  </span>
                  <span className="w-24 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.monthlyHealthInsurance)}
                  </span>
                </div>
                <div className="flex text-gray-400">
                  <span className="flex-1">Care</span>
                  <span className="w-28 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.annualCareInsurance)}
                  </span>
                  <span className="w-24 text-right whitespace-nowrap">
                    −€{formatNumber(calculations.monthlyCareInsurance)}
                  </span>
                </div>
                {employmentMode === "employed" && (
                  <>
                    <div className="flex text-gray-400">
                      <span className="flex-1">Pension</span>
                      <span className="w-28 text-right whitespace-nowrap">
                        −€{formatNumber(calculations.annualPensionInsurance)}
                      </span>
                      <span className="w-24 text-right whitespace-nowrap">
                        −€{formatNumber(calculations.monthlyPensionInsurance)}
                      </span>
                    </div>
                    <div className="flex text-gray-400">
                      <span className="flex-1">Unemployment</span>
                      <span className="w-28 text-right whitespace-nowrap">
                        −€
                        {formatNumber(calculations.annualUnemploymentInsurance)}
                      </span>
                      <span className="w-24 text-right whitespace-nowrap">
                        −€
                        {formatNumber(
                          calculations.monthlyUnemploymentInsurance
                        )}
                      </span>
                    </div>
                  </>
                )}

                <div className="flex text-gray-300 font-medium pt-2 border-t border-gray-800">
                  <span className="flex-1">Total Deductions</span>
                  <span className="w-28 text-right text-red-400 whitespace-nowrap">
                    −€{formatNumber(calculations.totalDeductions)}
                  </span>
                  <span className="w-24 text-right text-red-400 whitespace-nowrap">
                    −€{formatNumber(calculations.monthlyTotalDeductions)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-800">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Net Annual</div>
                  <div className="text-2xl font-bold text-green-400">
                    €{formatNumber(calculations.netAnnual)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Net Monthly</div>
                  <div className="text-2xl font-bold text-green-400">
                    €{formatNumber(calculations.netMonthly)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                Disposable Income
              </div>
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Monthly Expenses
                  </label>
                  <input
                    type="number"
                    value={monthlyExpenses}
                    onChange={(e) => setMonthlyExpenses(e.target.value)}
                    className="bg-gray-950 border border-gray-800 rounded px-3 py-2 text-white text-base font-semibold text-center w-24 focus:outline-none focus:border-gray-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Monthly Disposable
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      calculations.disposableMonthly >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}>
                    €{formatNumber(calculations.disposableMonthly)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">
                    Annual Savings
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      calculations.disposableAnnual >= 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}>
                    €{formatNumber(calculations.disposableAnnual)}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
                Income Comparison
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex text-xs text-gray-600 uppercase tracking-wider mb-2 px-2">
                  <span className="flex-1">Gross/yr</span>
                  <span className="flex-1 text-right">Gross/mo</span>
                  <span className="flex-1 text-right">Net/mo</span>
                  <span className="w-20 text-right">+Net</span>
                  <span className="w-16 text-right">Rate</span>
                </div>
                {comparisonLevels.map((level, idx) => {
                  const isCurrent = level.grossMonthly === calculations.monthly;
                  const prevNet = idx > 0 ? comparisonLevels[idx - 1].netMonthly : null;
                  const diff = prevNet !== null ? level.netMonthly - prevNet : null;
                  return (
                    <div
                      key={idx}
                      className={`flex py-1 px-2 rounded ${
                        isCurrent
                          ? "bg-green-500/10 border border-green-500/30"
                          : ""
                      }`}>
                      <span
                        className={`flex-1 ${
                          isCurrent
                            ? "text-green-400 font-semibold"
                            : "text-gray-500"
                        }`}>
                        €{formatNumber(level.grossAnnual)}
                      </span>
                      <span
                        className={`flex-1 text-right ${
                          isCurrent
                            ? "text-green-400 font-semibold"
                            : "text-gray-500"
                        }`}>
                        €{formatNumber(level.grossMonthly)}
                      </span>
                      <span
                        className={`flex-1 text-right ${
                          isCurrent
                            ? "text-green-400 font-semibold"
                            : "text-gray-300"
                        }`}>
                        €{formatNumber(level.netMonthly)}
                      </span>
                      <span
                        className={`w-20 text-right ${
                          isCurrent
                            ? "text-green-400 font-semibold"
                            : "text-cyan-400"
                        }`}>
                        {diff !== null ? `+€${formatNumber(diff)}` : "—"}
                      </span>
                      <span
                        className={`w-16 text-right ${
                          isCurrent
                            ? "text-green-400 font-semibold"
                            : "text-gray-500"
                        }`}>
                        {level.rate.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
