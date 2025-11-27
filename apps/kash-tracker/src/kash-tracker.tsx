import { useState, useMemo } from "react";

interface Day {
  id: number;
  profit: string;
}

interface AnalyzedDay extends Day {
  profitNum: number;
  isLiveDay?: boolean;
  percentage?: number;
  isViolating?: boolean;
  maxAllowed?: number;
  excess?: number;
}

const ConsistencyTracker = () => {
  const [consistencyLimit, setConsistencyLimit] = useState(50);
  const [profitTarget, setProfitTarget] = useState("");
  const [liveBalance, setLiveBalance] = useState("");
  const [days, setDays] = useState<Day[]>([{ id: 1, profit: "" }]);

  const addDay = () => {
    const newId = Math.max(...days.map((d) => d.id), 0) + 1;
    setDays([...days, { id: newId, profit: "" }]);
  };

  const removeDay = (id: number) => {
    if (days.length > 1) {
      setDays(days.filter((d) => d.id !== id));
    }
  };

  const updateProfit = (id: number, value: string) => {
    setDays(days.map((d) => (d.id === id ? { ...d, profit: value } : d)));
  };

  const analysis = useMemo(() => {
    // Calculate sum of days with entered profits
    const enteredDays = days.filter(
      (d) => d.profit !== "" && !isNaN(parseFloat(d.profit))
    );
    const enteredTotal = enteredDays.reduce(
      (sum, d) => sum + parseFloat(d.profit),
      0
    );

    // If live balance is set, calculate the "live day" P&L
    const liveBalanceNum = parseFloat(liveBalance) || 0;
    const liveDayPnL =
      liveBalanceNum > 0 ? liveBalanceNum - enteredTotal : null;

    // Build profitDays array - include live day if applicable
    const profitDays: AnalyzedDay[] = enteredDays.map((d) => ({
      ...d,
      profitNum: parseFloat(d.profit),
    }));

    // Find if there's an empty day row to use as "live" day
    const emptyDay = days.find((d) => d.profit === "" || d.profit === "0.00");
    if (liveDayPnL !== null && emptyDay) {
      profitDays.push({
        ...emptyDay,
        profitNum: liveDayPnL,
        isLiveDay: true,
      });
    }

    const limitFraction = consistencyLimit / 100;
    const targetNum = parseFloat(profitTarget) || 0;

    // Safety: ensure limit is between 1-99 to avoid division issues
    const safeLimitFraction = Math.max(0.01, Math.min(0.99, limitFraction));

    if (profitDays.length === 0) {
      // Even with no days, calculate target-based guidance
      const maxPerDayFromTarget = targetNum * safeLimitFraction;
      const minDaysNeeded =
        maxPerDayFromTarget > 0
          ? Math.ceil(targetNum / maxPerDayFromTarget)
          : 0;

      return {
        totalProfit: 0,
        dayAnalysis: [],
        maxSingleDayAllowed: 0,
        isViolating: false,
        worstViolation: null,
        safeToMakeToday: maxPerDayFromTarget > 0 ? maxPerDayFromTarget : null,
        currentlyViolating: false,
        minNeededToFix: null,
        // Target analysis
        targetNum,
        effectiveTarget: targetNum,
        targetPushedUp: false,
        targetIncrease: 0,
        remainingToTarget: targetNum,
        maxPerDay: maxPerDayFromTarget,
        minDaysNeeded,
        guidance: null,
        targetPushedGuidance: null,
      };
    }

    const totalProfit = profitDays.reduce((sum, d) => sum + d.profitNum, 0);

    // Handle zero or negative total
    if (totalProfit <= 0) {
      return {
        totalProfit,
        dayAnalysis: profitDays.map((d) => ({
          ...d,
          percentage: 0,
          isViolating: false,
          maxAllowed: 0,
          excess: 0,
        })),
        maxSingleDayAllowed: 0,
        isViolating: false,
        worstViolation: null,
        safeToMakeToday: targetNum > 0 ? targetNum * safeLimitFraction : null,
        currentlyViolating: false,
        minNeededToFix: null,
        targetNum,
        effectiveTarget: targetNum,
        targetPushedUp: false,
        targetIncrease: 0,
        remainingToTarget: targetNum,
        maxPerDay: targetNum * safeLimitFraction,
        minDaysNeeded: targetNum > 0 ? Math.ceil(1 / safeLimitFraction) : 0,
        guidance: null,
        targetPushedGuidance: null,
      };
    }

    const dayAnalysis = profitDays.map((d) => {
      const percentage = (d.profitNum / totalProfit) * 100;
      // Only flag violations if there are 2+ trading days
      const isViolating =
        profitDays.length >= 2 && percentage > consistencyLimit;
      const maxAllowed = totalProfit * safeLimitFraction;
      const excess = isViolating ? d.profitNum - maxAllowed : 0;

      return {
        ...d,
        percentage,
        isViolating,
        maxAllowed,
        excess,
      };
    });

    const violations = dayAnalysis.filter((d) => d.isViolating);
    const worstViolation =
      violations.length > 0
        ? violations.reduce((worst, d) =>
            d.percentage > worst.percentage ? d : worst
          )
        : null;

    // Calculate safe amount for future trading
    const maxDayProfit =
      profitDays.length > 0
        ? Math.max(...profitDays.map((d) => d.profitNum))
        : 0;

    let safeToMakeToday = 0;
    let minNeededToFix = null;
    let currentlyViolating = false;

    // If we have a profit target, that sets the baseline max per day
    const baselineMaxFromTarget =
      targetNum > 0 ? targetNum * safeLimitFraction : 0;

    if (totalProfit > 0) {
      // Only consider it a violation if there are 2+ days
      currentlyViolating =
        profitDays.length >= 2 &&
        maxDayProfit / totalProfit > safeLimitFraction;

      if (currentlyViolating) {
        // We need to ADD profit to dilute the big day down to exactly limit%
        // maxDay / (total + X) = limit
        // maxDay = limit * (total + X)
        // maxDay / limit = total + X
        // X = maxDay / limit - total
        minNeededToFix = maxDayProfit / safeLimitFraction - totalProfit;
        safeToMakeToday = minNeededToFix;
      } else {
        // Not violating - how much can we add without causing a violation?
        // New day can't exceed limit of new total
        // X / (total + X) <= limit  =>  X <= limit * total / (1 - limit)
        const selfConstraint =
          (safeLimitFraction * totalProfit) / (1 - safeLimitFraction);
        safeToMakeToday = selfConstraint;
      }
    } else if (totalProfit === 0) {
      // No profits yet - use target-based max if available
      safeToMakeToday =
        baselineMaxFromTarget > 0 ? baselineMaxFromTarget : Infinity;
    }

    // Profit target analysis
    // (targetNum already declared above for baseline calculation)

    // Effective target = max of (original target, minimum needed for consistency)
    // Minimum for consistency = biggest day / limit
    const minTotalForConsistency =
      maxDayProfit > 0 ? maxDayProfit / safeLimitFraction : 0;
    const effectiveTarget = Math.max(targetNum, minTotalForConsistency);
    const targetPushedUp = effectiveTarget > targetNum && targetNum > 0;
    const targetIncrease = targetPushedUp ? effectiveTarget - targetNum : 0;

    // Remaining to hit effective target
    const remainingToTarget = Math.max(0, effectiveTarget - totalProfit);

    // Max per day based on effective target
    const maxPerDayFromTarget = effectiveTarget * safeLimitFraction;

    // What's the max you can make on a NEW day without violating?
    // X / (total + X) <= limit
    // X <= limit * (total + X)
    // X <= limit * total + limit * X
    // X - limit * X <= limit * total
    // X * (1 - limit) <= limit * total
    // X <= (limit * total) / (1 - limit)
    // Max you can make on a NEW day without that new day becoming a violation:
    // X / (total + X) <= limit
    // Solving: X <= (limit * total) / (1 - limit)
    const maxNextDayWithoutViolation =
      totalProfit > 0
        ? (safeLimitFraction * totalProfit) / (1 - safeLimitFraction)
        : maxPerDayFromTarget;

    // Use the lower of: target-based max OR the self-constraint max
    // This applies whether violating or not - the constraint is about the NEW day
    const actualMaxPerDay = Math.min(
      maxPerDayFromTarget,
      maxNextDayWithoutViolation
    );

    // Minimum trading days needed = remaining / actual max per day (rounded up)
    const minDaysNeeded =
      actualMaxPerDay > 0 ? Math.ceil(remainingToTarget / actualMaxPerDay) : 0;

    // Actionable guidance when violating
    let guidance = null;
    if (currentlyViolating && profitDays.length > 0) {
      // Find the violating day(s)
      const violatingDays = dayAnalysis.filter((d) => d.isViolating);
      const biggestDay = violatingDays.reduce(
        (max, d) => (d.profitNum > max.profitNum ? d : max),
        violatingDays[0]
      );

      // Option A: Add more profit today to dilute
      // Need: biggestDay / (total + X) = limit
      // X = biggestDay / limit - total
      const addMoreToFix = minNeededToFix ?? 0;
      const newTotalAfterAdd = totalProfit + addMoreToFix;

      // Option B: Reduce the big day (take a loss on it)
      // Need: (biggestDay - X) / (total - X) = limit
      // biggestDay - X = limit * (total - X)
      // biggestDay - X = limit * total - limit * X
      // biggestDay - limit * total = X - limit * X
      // biggestDay - limit * total = X * (1 - limit)
      // X = (biggestDay - limit * total) / (1 - limit)
      const reduceAmount =
        (biggestDay.profitNum - safeLimitFraction * totalProfit) /
        (1 - safeLimitFraction);
      const newBigDayAfterReduce = biggestDay.profitNum - reduceAmount;

      // Option C: Safe range for next trade
      // Min to fix: same as addMoreToFix
      // Max allowed: lower of (self-constraint max) and (target-based max)
      // This ensures user doesn't exceed what's needed for their target
      const tomorrowMin = addMoreToFix;
      const selfConstraintMax =
        (safeLimitFraction * totalProfit) / (1 - safeLimitFraction);
      const tomorrowMax =
        targetNum > 0
          ? Math.min(selfConstraintMax, targetNum * safeLimitFraction)
          : selfConstraintMax;

      // Check if the biggest violating day is the last entry (can still reduce it)
      const lastDayId = profitDays[profitDays.length - 1].id;
      const canReduceBigDay = biggestDay.id === lastDayId;

      guidance = {
        biggestDay,
        // Option A: Add more today
        addMoreToFix,
        newTotalAfterAdd,
        // Option B: Take a loss (only if it's the last day)
        canReduceBigDay,
        reduceAmount,
        newBigDayAfterReduce,
        // Option C: Tomorrow
        tomorrowMin,
        tomorrowMax,
      };
    }

    // Guidance when target is pushed up but not technically violating (e.g., single day)
    // User should have option to reduce to stay within original target
    let targetPushedGuidance = null;
    if (targetPushedUp && !currentlyViolating && profitDays.length > 0) {
      const biggestDay = dayAnalysis.reduce(
        (max, d) => (d.profitNum > max.profitNum ? d : max),
        dayAnalysis[0]
      );
      const maxAllowedForOriginalTarget = targetNum * safeLimitFraction;

      // Amount to reduce to bring biggest day to 50% of original target
      const reduceToMeetOriginalTarget =
        biggestDay.profitNum - maxAllowedForOriginalTarget;
      const newBigDayAfterReduce = maxAllowedForOriginalTarget;

      // Can only reduce if it's the last day
      const lastDayId = profitDays[profitDays.length - 1].id;
      const canReduceBigDay = biggestDay.id === lastDayId;

      targetPushedGuidance = {
        biggestDay,
        canReduceBigDay,
        reduceAmount: reduceToMeetOriginalTarget,
        newBigDayAfterReduce,
        originalTargetMax: maxAllowedForOriginalTarget,
      };
    }

    return {
      totalProfit,
      dayAnalysis,
      maxSingleDayAllowed: totalProfit * safeLimitFraction,
      isViolating: violations.length > 0,
      worstViolation,
      safeToMakeToday: safeToMakeToday === Infinity ? null : safeToMakeToday,
      currentlyViolating,
      minNeededToFix,
      // Target analysis
      targetNum,
      effectiveTarget,
      targetPushedUp,
      targetIncrease,
      remainingToTarget,
      maxPerDay: actualMaxPerDay,
      minDaysNeeded,
      guidance,
      targetPushedGuidance,
    };
  }, [days, consistencyLimit, profitTarget, liveBalance]);

  const formatCurrency = (num: number | null | undefined) => {
    if (num === null || num === undefined) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatPercent = (num: number) => {
    return num.toFixed(1) + "%";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0b",
        color: "#e8e8e8",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        padding: "40px 20px",
      }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        input[type=number] {
          -moz-appearance: textfield;
        }

        input:focus {
          outline: none;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .day-row {
          animation: slideIn 0.3s ease-out;
        }

        .violation-pulse {
          animation: pulse 2s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}>
        {/* Header */}
        <div
          style={{
            marginBottom: "48px",
            borderBottom: "1px solid #222",
            paddingBottom: "32px",
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
            }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                background: analysis.isViolating ? "#ff4444" : "#00ff88",
                borderRadius: "50%",
                boxShadow: analysis.isViolating
                  ? "0 0 12px #ff4444"
                  : "0 0 12px #00ff88",
              }}
            />
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "28px",
                fontWeight: "600",
                margin: 0,
                letterSpacing: "-0.5px",
                color: "#fff",
              }}>
              Yoto's Consistency Rule Tracker
            </h1>
          </div>
          <p
            style={{
              color: "#666",
              fontSize: "13px",
              margin: 0,
              paddingLeft: "20px",
            }}>
            Prop Firm Payout Compliance Monitor
          </p>
        </div>

        {/* Settings */}
        <div
          style={{
            background: "#111112",
            border: "1px solid #1a1a1b",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "24px",
            }}>
            {/* Consistency Limit */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "12px",
                }}>
                Consistency Limit
              </label>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}>
                <input
                  type="number"
                  value={consistencyLimit}
                  onChange={(e) =>
                    setConsistencyLimit(
                      Math.max(
                        1,
                        Math.min(100, parseFloat(e.target.value) || 0)
                      )
                    )
                  }
                  style={{
                    width: "80px",
                    background: "#0a0a0b",
                    border: "1px solid #2a2a2b",
                    borderRadius: "4px",
                    padding: "12px 16px",
                    color: "#fff",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                />
                <span style={{ color: "#666", fontSize: "14px" }}>%</span>
              </div>
            </div>

            {/* Profit Target */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "12px",
                }}>
                Profit Target
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#444",
                    fontSize: "14px",
                  }}>
                  $
                </span>
                <input
                  type="number"
                  placeholder="e.g. 3000"
                  value={profitTarget}
                  onChange={(e) => setProfitTarget(e.target.value)}
                  style={{
                    width: "140px",
                    background: "#0a0a0b",
                    border: "1px solid #2a2a2b",
                    borderRadius: "4px",
                    padding: "12px 16px 12px 28px",
                    color: "#fff",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    fontWeight: "600",
                  }}
                />
              </div>
            </div>

            {/* Live Balance */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "12px",
                }}>
                Live Balance{" "}
                <span style={{ color: "#444", textTransform: "none" }}>
                  (optional)
                </span>
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#444",
                    fontSize: "14px",
                  }}>
                  $
                </span>
                <input
                  type="number"
                  placeholder="Current balance"
                  value={liveBalance}
                  onChange={(e) => setLiveBalance(e.target.value)}
                  style={{
                    width: "140px",
                    background: "#0a0a0b",
                    border: liveBalance
                      ? "1px solid #00aaff"
                      : "1px solid #2a2a2b",
                    borderRadius: "4px",
                    padding: "12px 16px 12px 28px",
                    color: "#00aaff",
                    fontSize: "16px",
                    fontFamily: "inherit",
                    fontWeight: "600",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Entries */}
        <div
          style={{
            background: "#111112",
            border: "1px solid #1a1a1b",
            borderRadius: "8px",
            padding: "24px",
            marginBottom: "24px",
          }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}>
            <label
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#666",
              }}>
              Daily P&L
            </label>
            <button
              onClick={addDay}
              style={{
                background: "#1a1a1b",
                border: "1px solid #2a2a2b",
                borderRadius: "4px",
                padding: "8px 16px",
                color: "#888",
                fontSize: "12px",
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                const target = e.currentTarget;
                target.style.background = "#222";
                target.style.color = "#fff";
              }}
              onMouseOut={(e) => {
                const target = e.currentTarget;
                target.style.background = "#1a1a1b";
                target.style.color = "#888";
              }}>
              + Add Day
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr 80px 60px",
              gap: "8px",
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "#444",
              marginBottom: "12px",
              padding: "0 4px",
            }}>
            <div>Day</div>
            <div>Profit/Loss</div>
            <div style={{ textAlign: "right" }}>% of Total</div>
            <div></div>
          </div>

          {days.map((day, index) => {
            const dayAnalysis = analysis.dayAnalysis.find(
              (d) => d.id === day.id
            );
            const liveDay = analysis.dayAnalysis.find(
              (d) => d.isLiveDay && d.id === day.id
            );
            const isViolating =
              dayAnalysis?.isViolating || liveDay?.isViolating || false;
            const percentage = dayAnalysis?.percentage ?? liveDay?.percentage;
            const isThisLiveDay = liveDay || (day.profit === "" && liveBalance);

            return (
              <div
                key={day.id}
                className="day-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "80px 1fr 80px 60px",
                  gap: "8px",
                  marginBottom: "8px",
                  alignItems: "center",
                }}>
                <div
                  style={{
                    color: "#888",
                    fontSize: "14px",
                    fontWeight: "500",
                    padding: "10px 0",
                  }}>
                  Day {index + 1}
                </div>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: isThisLiveDay ? "#00aaff" : "#444",
                      fontSize: "14px",
                    }}>
                    $
                  </span>
                  {isThisLiveDay && liveDay ? (
                    <div
                      style={{
                        width: "100%",
                        background: isViolating
                          ? "rgba(255, 68, 68, 0.1)"
                          : "rgba(0, 170, 255, 0.1)",
                        border: isViolating
                          ? "1px solid #ff4444"
                          : "1px solid #00aaff",
                        borderRadius: "4px",
                        padding: "10px 12px 10px 28px",
                        color: liveDay.profitNum < 0 ? "#ff6b6b" : "#00aaff",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        fontWeight: "500",
                      }}>
                      {liveDay.profitNum.toFixed(2)}{" "}
                      <span
                        style={{
                          fontSize: "10px",
                          color: "#00aaff",
                          marginLeft: "4px",
                        }}>
                        LIVE
                      </span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={day.profit}
                      onChange={(e) => updateProfit(day.id, e.target.value)}
                      style={{
                        width: "100%",
                        background: isViolating
                          ? "rgba(255, 68, 68, 0.1)"
                          : "#0a0a0b",
                        border: isViolating
                          ? "1px solid #ff4444"
                          : "1px solid #2a2a2b",
                        borderRadius: "4px",
                        padding: "10px 12px 10px 28px",
                        color:
                          day.profit && parseFloat(day.profit) < 0
                            ? "#ff6b6b"
                            : "#fff",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        fontWeight: "500",
                        transition: "all 0.2s",
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    textAlign: "right",
                    fontSize: "13px",
                    fontWeight: "500",
                    color: isViolating
                      ? "#ff4444"
                      : (percentage ?? 0) > consistencyLimit * 0.8
                      ? "#ffaa00"
                      : "#666",
                  }}>
                  {percentage !== undefined ? formatPercent(percentage) : "—"}
                </div>
                <button
                  onClick={() => removeDay(day.id)}
                  disabled={days.length === 1}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: days.length === 1 ? "#333" : "#666",
                    fontSize: "18px",
                    cursor: days.length === 1 ? "not-allowed" : "pointer",
                    padding: "8px",
                    borderRadius: "4px",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    if (days.length > 1)
                      e.currentTarget.style.color = "#ff4444";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = "#666";
                  }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Analysis Panel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: analysis.currentlyViolating
              ? "repeat(3, 1fr)"
              : "repeat(1, 1fr)",
            gap: "16px",
            marginBottom: "24px",
          }}>
          {/* Total Profit */}
          <div
            style={{
              background: "#111112",
              border: "1px solid #1a1a1b",
              borderRadius: "8px",
              padding: "20px",
            }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#666",
                marginBottom: "8px",
              }}>
              Total Profit
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: "600",
                color:
                  analysis.totalProfit > 0
                    ? "#00ff88"
                    : analysis.totalProfit < 0
                    ? "#ff4444"
                    : "#888",
              }}>
              {formatCurrency(analysis.totalProfit)}
            </div>
          </div>

          {/* Target Balance - only show when violating */}
          {analysis.currentlyViolating && (
            <div
              style={{
                background: "#111112",
                border: "1px solid #1a1a1b",
                borderRadius: "8px",
                padding: "20px",
              }}>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "8px",
                }}>
                Target Balance
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#ccc",
                }}>
                {formatCurrency(
                  analysis.totalProfit + (analysis.minNeededToFix || 0)
                )}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#555",
                  marginTop: "4px",
                }}>
                Account balance to fix violation
              </div>
            </div>
          )}

          {/* To Fix Violation - only show when violating */}
          {analysis.currentlyViolating && (
            <div
              style={{
                background: "#111112",
                border: "1px solid #1a1a1b",
                borderRadius: "8px",
                padding: "20px",
              }}>
              <div
                style={{
                  fontSize: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "8px",
                }}>
                To Fix Violation
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "600",
                  color: "#ffaa00",
                }}>
                {formatCurrency(analysis.minNeededToFix)}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#555",
                  marginTop: "4px",
                }}>
                For consistency compliance
              </div>
            </div>
          )}
        </div>

        {/* Target Analysis Panel - collapsed when violating, expanded when compliant */}
        {analysis.targetNum > 0 &&
          (analysis.currentlyViolating ? (
            // Collapsed state when violating
            <div
              style={{
                background: "#0d0d0e",
                border: "1px solid #1a1a1b",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "24px",
                opacity: 0.6,
              }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "12px",
                  fontSize: "12px",
                  color: "#888",
                }}>
                <span
                  style={{
                    color: "#555",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    fontSize: "10px",
                  }}>
                  Target Analysis
                </span>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  <span>
                    Target:{" "}
                    <span
                      style={{
                        color: analysis.targetPushedUp ? "#ffaa00" : "#aaa",
                      }}>
                      {formatCurrency(analysis.effectiveTarget)}
                    </span>
                  </span>
                  <span>
                    Remaining:{" "}
                    <span style={{ color: "#aaa" }}>
                      {formatCurrency(analysis.remainingToTarget)}
                    </span>
                  </span>
                  <span>
                    Max/day:{" "}
                    <span style={{ color: "#6699cc" }}>
                      {formatCurrency(analysis.maxPerDay)}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // Expanded state when compliant
            <div
              style={{
                background: "#111112",
                border: "1px solid #1a1a1b",
                borderRadius: "8px",
                padding: "24px",
                marginBottom: "24px",
              }}>
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#666",
                  marginBottom: "20px",
                }}>
                Target Analysis
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "20px",
                }}>
                {/* Target - combined display */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#555",
                      marginBottom: "6px",
                    }}>
                    Target
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}>
                    {analysis.targetPushedUp ? (
                      <>
                        <span
                          style={{
                            color: "#666",
                            textDecoration: "line-through",
                            whiteSpace: "nowrap",
                          }}>
                          {formatCurrency(analysis.targetNum)}
                        </span>
                        <span style={{ color: "#555" }}>→</span>
                        <span
                          style={{ color: "#ffaa00", whiteSpace: "nowrap" }}>
                          {formatCurrency(analysis.effectiveTarget)}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: "#00ff88" }}>
                        {formatCurrency(analysis.effectiveTarget)}
                      </span>
                    )}
                  </div>
                  {analysis.targetPushedUp && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#ffaa00",
                        marginTop: "2px",
                      }}>
                      Pushed up by consistency rule
                    </div>
                  )}
                </div>

                {/* Remaining */}
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#555",
                      marginBottom: "6px",
                    }}>
                    To Target
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "#00ff88",
                    }}>
                    {analysis.remainingToTarget > 0
                      ? formatCurrency(analysis.remainingToTarget)
                      : "✓ At Target"}
                  </div>
                </div>

                {/* Max Per Day */}
                {/* Max Per Day - only show when still working toward target */}
                {analysis.remainingToTarget > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        color: "#555",
                        marginBottom: "6px",
                      }}>
                      Max Per Day
                    </div>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#00aaff",
                      }}>
                      {formatCurrency(analysis.maxPerDay)}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color:
                          analysis.remainingToTarget < analysis.maxPerDay
                            ? "#00ff88"
                            : "#444",
                        marginTop: "2px",
                      }}>
                      {analysis.remainingToTarget < analysis.maxPerDay
                        ? `Only ${formatCurrency(
                            analysis.remainingToTarget
                          )} needed to complete`
                        : analysis.dayAnalysis.some(
                            (d) => d.percentage >= consistencyLimit - 0.1
                          )
                        ? "For next day — current day at limit"
                        : "Safe limit for next trade"}
                    </div>
                  </div>
                )}

                {/* Min Days Needed */}
                {analysis.remainingToTarget > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        color: "#555",
                        marginBottom: "6px",
                      }}>
                      Min Days Needed
                    </div>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "600",
                        color: "#ccc",
                      }}>
                      {analysis.minDaysNeeded}
                    </div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#444",
                        marginTop: "2px",
                      }}>
                      At max {formatCurrency(analysis.maxPerDay)}/day
                    </div>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: "24px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    color: "#666",
                    marginBottom: "8px",
                  }}>
                  <span>Progress to Target</span>
                  <span>
                    {(
                      (analysis.totalProfit / analysis.effectiveTarget) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div
                  style={{
                    height: "8px",
                    background: "#1a1a1b",
                    borderRadius: "4px",
                    overflow: "hidden",
                  }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(
                        100,
                        (analysis.totalProfit / analysis.effectiveTarget) * 100
                      )}%`,
                      background:
                        analysis.totalProfit >= analysis.effectiveTarget
                          ? "#00ff88"
                          : "linear-gradient(90deg, #00aaff 0%, #00ff88 100%)",
                      borderRadius: "4px",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Target Pushed Guidance - option to reduce back to original target */}
              {analysis.targetPushedGuidance &&
                analysis.targetPushedGuidance.canReduceBigDay && (
                  <div
                    style={{
                      marginTop: "20px",
                      background: "rgba(255, 170, 0, 0.08)",
                      border: "1px solid rgba(255, 170, 0, 0.2)",
                      borderRadius: "6px",
                      padding: "16px",
                    }}>
                    <div
                      style={{
                        fontSize: "10px",
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        color: "#ffaa00",
                        marginBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}>
                      <span>💡</span> Option to Meet Original Target
                    </div>
                    <div
                      style={{
                        color: "#ccc",
                        fontSize: "13px",
                        lineHeight: "1.5",
                      }}>
                      Give back{" "}
                      <span style={{ color: "#ffaa00", fontWeight: "600" }}>
                        {formatCurrency(
                          analysis.targetPushedGuidance.reduceAmount
                        )}
                      </span>{" "}
                      on{" "}
                      Day {analysis.targetPushedGuidance.biggestDay.id}
                      {" → "}P&L becomes{" "}
                      <span style={{ color: "#fff", fontWeight: "500" }}>
                        {formatCurrency(
                          analysis.targetPushedGuidance.newBigDayAfterReduce
                        )}
                      </span>
                    </div>
                    <div
                      style={{
                        color: "#666",
                        fontSize: "11px",
                        marginTop: "6px",
                      }}>
                      This keeps your max day at {consistencyLimit}% of original{" "}
                      {formatCurrency(analysis.targetNum)} target
                    </div>
                  </div>
                )}
            </div>
          ))}

        {/* Status Banner */}
        {analysis.dayAnalysis.length > 0 && (
          <div
            className={analysis.isViolating ? "violation-pulse" : ""}
            style={{
              background: analysis.isViolating
                ? "linear-gradient(135deg, rgba(255,68,68,0.15) 0%, rgba(255,68,68,0.05) 100%)"
                : "linear-gradient(135deg, rgba(0,255,136,0.15) 0%, rgba(0,255,136,0.05) 100%)",
              border: analysis.isViolating
                ? "1px solid rgba(255,68,68,0.3)"
                : "1px solid rgba(0,255,136,0.3)",
              borderRadius: "8px",
              padding: "20px 24px",
            }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}>
              <div
                style={{
                  fontSize: "24px",
                }}>
                {analysis.isViolating ? "⚠" : "✓"}
              </div>
              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: analysis.isViolating ? "#ff4444" : "#00ff88",
                    marginBottom: "4px",
                  }}>
                  {analysis.isViolating
                    ? "CONSISTENCY RULE VIOLATION"
                    : "WITHIN CONSISTENCY LIMITS"}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#888",
                  }}>
                  {analysis.isViolating && analysis.worstViolation
                    ? `Worst: ${formatPercent(
                        analysis.worstViolation.percentage
                      )} on single day (limit: ${consistencyLimit}%)`
                    : `All days are under ${consistencyLimit}% of total profit`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Violation Details */}
        {analysis.isViolating && (
          <div
            style={{
              marginTop: "16px",
              background: "#111112",
              border: "1px solid #1a1a1b",
              borderRadius: "8px",
              padding: "20px",
            }}>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#666",
                marginBottom: "16px",
              }}>
              Violating Days
            </div>
            {analysis.dayAnalysis
              .filter((d) => d.isViolating)
              .map((d, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid #1a1a1b",
                  }}>
                  <div>
                    <span style={{ color: "#888" }}>Day {d.id}</span>
                    <span style={{ color: "#444", margin: "0 8px" }}>→</span>
                    <span style={{ color: "#ff4444", fontWeight: "500" }}>
                      {formatPercent(d.percentage)}
                    </span>
                    <span
                      style={{
                        color: "#555",
                        marginLeft: "8px",
                        fontSize: "12px",
                      }}>
                      (limit: {consistencyLimit}%)
                    </span>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* What To Do - Actionable Guidance */}
        {analysis.guidance && (
          <div
            style={{
              marginTop: "16px",
              background:
                "linear-gradient(135deg, rgba(0, 170, 255, 0.08) 0%, rgba(0, 255, 136, 0.05) 100%)",
              border: "1px solid rgba(0, 170, 255, 0.2)",
              borderRadius: "8px",
              padding: "24px",
            }}>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#00aaff",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}>
              <span style={{ fontSize: "16px" }}>💡</span>
              What To Do
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}>
              {/* Option A: Add more on another day */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "6px",
                  padding: "16px",
                  borderLeft: "3px solid #00ff88",
                }}>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#00ff88",
                    marginBottom: "8px",
                  }}>
                  Option A: Earn More (New Day)
                </div>
                <div
                  style={{
                    color: "#e8e8e8",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}>
                  Make{" "}
                  <span style={{ color: "#00ff88", fontWeight: "600" }}>
                    {formatCurrency(analysis.guidance.addMoreToFix)}
                  </span>{" "}
                  on another trading day → new total becomes{" "}
                  <span style={{ color: "#fff", fontWeight: "500" }}>
                    {formatCurrency(analysis.guidance.newTotalAfterAdd)}
                  </span>
                </div>
                <div
                  style={{ color: "#666", fontSize: "12px", marginTop: "6px" }}>
                  Dilutes the big day back to exactly {consistencyLimit}%
                </div>
              </div>

              {/* Option B: Take a loss - only show if violating day is the last entry */}
              {analysis.guidance.canReduceBigDay && (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "6px",
                    padding: "16px",
                    borderLeft: "3px solid #ffaa00",
                  }}>
                  <div
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      color: "#ffaa00",
                      marginBottom: "8px",
                    }}>
                    Option B: Reduce Big Day
                  </div>
                  <div
                    style={{
                      color: "#e8e8e8",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}>
                    Give back{" "}
                    <span style={{ color: "#ffaa00", fontWeight: "600" }}>
                      {formatCurrency(analysis.guidance.reduceAmount)}
                    </span>{" "}
                    on{" "}
                    Day {analysis.guidance.biggestDay.id}
                    → P&L becomes{" "}
                    <span style={{ color: "#fff", fontWeight: "500" }}>
                      {formatCurrency(analysis.guidance.newBigDayAfterReduce)}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "#666",
                      fontSize: "12px",
                      marginTop: "6px",
                    }}>
                    New total:{" "}
                    <span style={{ color: "#ccc" }}>
                      {formatCurrency(
                        analysis.totalProfit - analysis.guidance.reduceAmount
                      )}
                    </span>{" "}
                    — Take a controlled loss to bring that day under the limit
                  </div>
                </div>
              )}

              {/* Option C: Future day range */}
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.3)",
                  borderRadius: "6px",
                  padding: "16px",
                  borderLeft: "3px solid #00aaff",
                }}>
                <div
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#00aaff",
                    marginBottom: "8px",
                  }}>
                  Safe Range Per Day
                </div>
                <div
                  style={{
                    color: "#e8e8e8",
                    fontSize: "14px",
                    lineHeight: "1.5",
                  }}>
                  {(analysis.guidance.tomorrowMin ?? 0) <=
                  (analysis.guidance.tomorrowMax ?? 0) ? (
                    <>
                      Aim for{" "}
                      <span style={{ color: "#00aaff", fontWeight: "600" }}>
                        {formatCurrency(analysis.guidance.tomorrowMin)}
                      </span>{" "}
                      to{" "}
                      <span style={{ color: "#00aaff", fontWeight: "600" }}>
                        {formatCurrency(analysis.guidance.tomorrowMax)}
                      </span>{" "}
                      per day
                    </>
                  ) : (
                    <>
                      Aim for{" "}
                      <span style={{ color: "#00aaff", fontWeight: "600" }}>
                        {formatCurrency(analysis.guidance.tomorrowMax)}
                      </span>{" "}
                      per day over multiple days
                    </>
                  )}
                </div>
                <div
                  style={{ color: "#666", fontSize: "12px", marginTop: "6px" }}>
                  {(analysis.guidance.tomorrowMin ?? 0) <=
                  (analysis.guidance.tomorrowMax ?? 0)
                    ? "Min to fix violation, max before creating a new one"
                    : `Need ${Math.ceil(
                        (analysis.guidance.tomorrowMin ?? 0) /
                          (analysis.guidance.tomorrowMax ?? 1)
                      )} more days to fix at this pace`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid #1a1a1b",
            textAlign: "center",
            color: "#333",
            fontSize: "11px",
          }}>
          Consistency Rule: No more than {consistencyLimit}% of total profits in
          a payout period from a single day
        </div>
      </div>
    </div>
  );
};

export default ConsistencyTracker;
